import './style.css';

// 타입 정의
interface SnowBox {
  id: string;
  title: string;
  dept: string;
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    kakao: any;
  }
}

// 전역 변수
let markers: any[] = []; // 현재 표시 중인 마커만 저장
const MAX_MARKERS = 200; // 최대 표시 개수

// 1. 데이터 로드
async function loadData(): Promise<SnowBox[]> {
  try {
    const res = await fetch('/snow_boxes_final.json');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();

    if (!json.items || !Array.isArray(json.items)) {
      throw new Error('데이터 형식이 올바르지 않습니다.');
    }

    return json.items;
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    alert('제설함 데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    return [];
  }
}

// 2. 지도 중심에서 가까운 마커만 렌더링
function renderMarkers(map: any, data: SnowBox[]) {
  // 1. 기존 마커 제거
  markers.forEach(m => m.setMap(null));
  markers = [];

  // 2. 현재 지도 중심 좌표 가져오기
  const center = map.getCenter();
  const centerLat = center.getLat();
  const centerLng = center.getLng();

  // 3. 모든 데이터에 대해 거리 계산 및 정렬
  const dataWithDistance = data.map(box => {
    const distance = Math.sqrt(
      Math.pow(box.lat - centerLat, 2) +
      Math.pow(box.lng - centerLng, 2)
    );
    return { ...box, distance };
  }).sort((a, b) => a.distance - b.distance);

  // 4. 가까운 200개만 마커 생성
  const nearbyData = dataWithDistance.slice(0, MAX_MARKERS);

  nearbyData.forEach(box => {
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(box.lat, box.lng),
      title: box.title
    });

    // 인포윈도우는 마커 클릭 시 생성 (미리 생성하지 않음)
    window.kakao.maps.event.addListener(marker, 'click', function() {
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `
          <div style="padding:10px; min-width:200px;">
            <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:bold; color:#333;">
              ${box.title}
            </h3>
            <p style="margin:0; font-size:12px; color:#666;">
              <strong>관리:</strong> ${box.dept}
            </p>
            <p style="margin:4px 0 0 0; font-size:11px; color:#999;">
              ID: ${box.id}
            </p>
          </div>
        `,
        removable: true
      });
      infowindow.open(map, marker);
    });

    marker.setMap(map);
    markers.push(marker);
  });
}

// 3. 화면 영역 내 제설함 카운트 업데이트
function updateVisibleCount(map: any, data: SnowBox[]) {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const visibleCount = data.filter(box =>
    box.lat >= sw.getLat() &&
    box.lat <= ne.getLat() &&
    box.lng >= sw.getLng() &&
    box.lng <= ne.getLng()
  ).length;

  const countElement = document.getElementById('count');
  if (countElement) {
    countElement.textContent = visibleCount.toString();
  }
}

// 4. 지도 초기화
async function initMap() {
  // 데이터 로드
  const data = await loadData();

  if (data.length === 0) {
    console.error('로드된 데이터가 없습니다.');
    return;
  }

  console.log(`총 ${data.length}개의 제설함 데이터 로드 완료`);

  // 지도 컨테이너 확인
  const container = document.getElementById('map');
  if (!container) {
    console.error('지도 컨테이너를 찾을 수 없습니다.');
    return;
  }

  // 지도 옵션 설정
  const options = {
    center: new window.kakao.maps.LatLng(37.5759, 126.9768), // 광화문
    level: 5 // 중간 확대 레벨
  };

  // 지도 생성
  const map = new window.kakao.maps.Map(container, options);

  // 초기 마커 렌더링
  renderMarkers(map, data);

  // 초기 카운트 업데이트
  updateVisibleCount(map, data);

  // 지도 이동/줌 이벤트 리스너
  window.kakao.maps.event.addListener(map, 'idle', () => {
    renderMarkers(map, data);
    updateVisibleCount(map, data);
  });

  // 검색 기능 구현
  const ps = new window.kakao.maps.services.Places();

  const searchHandler = () => {
    const keywordInput = document.getElementById('keyword') as HTMLInputElement;
    if (!keywordInput) return;

    const keyword = keywordInput.value.trim();

    if (!keyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    ps.keywordSearch(keyword, (result: any[], status: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        // 검색된 장소 중 첫 번째 장소로 이동
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        map.setCenter(coords);
        map.setLevel(5); // 검색 후 확대

        // idle 이벤트가 발생하여 자동으로 카운트 업데이트됨
      } else {
        alert('검색 결과가 없습니다. 다른 키워드로 검색해주세요.');
      }
    });
  };

  // 검색 버튼 클릭 이벤트
  document.getElementById('searchBtn')?.addEventListener('click', searchHandler);

  // Enter 키로 검색
  document.getElementById('keyword')?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchHandler();
    }
  });
}

// 5. 카카오 맵 SDK 로드 후 실행
window.onload = initMap;

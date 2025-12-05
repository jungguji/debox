import './style.css';

// 타입 정의
interface SnowBox {
  id: string;
  title: string;
  dept: string;
  lat: number;
  lng: number;
  type?: string; // 염화칼슘 데이터에만 존재
}

type DataType = 'snow' | 'calcium';

declare global {
  interface Window {
    kakao: any;
  }
}

// 전역 변수
let markers: any[] = []; // 현재 표시 중인 마커만 저장
const MAX_MARKERS = 200; // 최대 표시 개수
let snowData: SnowBox[] = []; // 제설함 데이터
let calciumData: SnowBox[] = []; // 염화칼슘 데이터
let currentDataType: DataType = 'snow'; // 현재 선택된 데이터 타입

// 1. 데이터 로드
async function loadData(filename: string): Promise<SnowBox[]> {
  try {
    const res = await fetch(`/${filename}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();

    if (!json.items || !Array.isArray(json.items)) {
      throw new Error('데이터 형식이 올바르지 않습니다.');
    }

    return json.items;
  } catch (error) {
    console.error(`${filename} 로드 실패:`, error);
    return [];
  }
}

// 모든 데이터를 로드하는 함수
async function loadAllData(): Promise<void> {
  const [snow, calcium] = await Promise.all([
    loadData('snow_boxes_final.json'),
    loadData('calcium_final.json')
  ]);

  snowData = snow;
  calciumData = calcium;

  console.log(`제설함 ${snowData.length}개, 염화칼슘보관함 ${calciumData.length}개 로드 완료`);
}

// 현재 선택된 데이터 타입에 따라 데이터 반환
function getCurrentData(): SnowBox[] {
  return currentDataType === 'snow' ? snowData : calciumData;
}

// 현재 데이터 타입의 한글 라벨 반환
function getCurrentLabel(): string {
  return currentDataType === 'snow' ? '제설함' : '염화칼슘보관함';
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
    // 마커 이미지 설정 (염화칼슘은 다른 색상)
    let markerImage = undefined;
    if (currentDataType === 'calcium') {
      const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png';
      const imageSize = new window.kakao.maps.Size(24, 35);
      markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);
    }

    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(box.lat, box.lng),
      title: box.title,
      image: markerImage // 염화칼슘일 경우 별 모양 마커
    });

    // 인포윈도우는 마커 클릭 시 생성 (미리 생성하지 않음)
    window.kakao.maps.event.addListener(marker, 'click', function() {
      const typeLabel = box.type === 'calcium' ? '염화칼슘보관함' : '제설함';
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `
          <div style="padding:10px; min-width:200px;">
            <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:bold; color:#333;">
              ${box.title}
            </h3>
            <p style="margin:0; font-size:12px; color:#666;">
              <strong>종류:</strong> ${typeLabel}
            </p>
            <p style="margin:4px 0 0 0; font-size:12px; color:#666;">
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

  // 카운트 업데이트
  const countElement = document.getElementById('count');
  if (countElement) {
    countElement.textContent = visibleCount.toString();
  }

  // 라벨 업데이트
  const labelElement = document.getElementById('data-type-label');
  if (labelElement) {
    labelElement.textContent = getCurrentLabel();
  }
}

// 탭 전환 시 호출되는 함수
function switchTab(newType: DataType, map: any) {
  // 현재 타입이 이미 선택되어 있으면 무시
  if (currentDataType === newType) return;

  // 데이터 타입 변경
  currentDataType = newType;

  // 현재 데이터 가져오기
  const currentData = getCurrentData();

  // 마커 재렌더링
  renderMarkers(map, currentData);

  // 카운트 업데이트
  updateVisibleCount(map, currentData);

  // 탭 버튼 활성화 상태 변경
  document.querySelectorAll('.tab-button').forEach(btn => {
    const button = btn as HTMLElement;
    if (button.dataset.type === newType) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });

  console.log(`탭 전환: ${getCurrentLabel()}`);
}

// 4. 지도 초기화
async function initMap() {
  // 모든 데이터 로드
  await loadAllData();

  if (snowData.length === 0 && calciumData.length === 0) {
    console.error('로드된 데이터가 없습니다.');
    alert('데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    return;
  }

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

  // 초기 데이터는 제설함 (currentDataType = 'snow')
  const currentData = getCurrentData();

  // 초기 마커 렌더링
  renderMarkers(map, currentData);

  // 초기 카운트 업데이트
  updateVisibleCount(map, currentData);

  // 지도 이동/줌 이벤트 리스너
  window.kakao.maps.event.addListener(map, 'idle', () => {
    const currentData = getCurrentData();
    renderMarkers(map, currentData);
    updateVisibleCount(map, currentData);
  });

  // 탭 버튼 이벤트 리스너 등록
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const btn = e.target as HTMLElement;
      const type = btn.dataset.type as DataType;
      switchTab(type, map);
    });
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

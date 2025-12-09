// 城市地标数据类型
export interface CityLandmark {
  id: string;
  name: string;
  city: string;
  province: string;
  coordinates: [number, number]; // [lng, lat]
  description?: string;
  icon?: string;
}

// 等时圈范围配置
export interface IsochroneRange {
  minutes: number;
  color: string;
  fillColor: string;
  opacity: number;
}

// 等时圈响应数据
export interface IsochroneFeature {
  type: 'Feature';
  properties: {
    value: number;
    center: [number, number];
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface IsochroneResponse {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
}

// 用户自定义出发点
export interface CustomLocation {
  id: string;
  name: string;
  coordinates: [number, number];
  userId?: string;
  createdAt: Date;
}

// 出行方式
export type TravelProfile = 
  | 'driving-car' 
  | 'cycling-regular' 
  | 'foot-walking';

// 地图状态
export interface MapState {
  center: [number, number];
  zoom: number;
  selectedLandmark: CityLandmark | null;
  isochrones: IsochroneFeature[];
  loading: boolean;
  error: string | null;
}

// 分享链接参数
export interface ShareParams {
  lat: number;
  lng: number;
  name: string;
  profile: TravelProfile;
  range: number[];
}


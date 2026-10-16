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

// 兴趣点 (POI)
export interface InterestPoint {
  id: string;
  name: string;
  city: string;
  coordinates: [number, number]; // [lng, lat] (WGS-84)
  category: 'tourism' | 'food' | 'activity' | 'shopping' | 'other';
  description?: string;
  rating?: number; // 本地推荐指数 1-5（非第三方用户评分或实时评价）
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
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
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

// ==========================================
// 地点数据收录与覆盖架构 (#6 / #8)
// ==========================================

// 收录覆盖状态枚举
export type CoverageStatus =
  | 'matched'         // 覆盖区内有匹配地点
  | 'covered-empty'   // 覆盖区内但当前可达范围无匹配地点
  | 'uncovered'       // 未收录区域（超出本地维护范围）
  | 'partial';        // 部分覆盖（等时圈跨越收录边界且未匹配）

// 空间重叠程度
export type CoverageOverlap = 'full' | 'partial' | 'none';

// 本地维护的数据收录区域声明
export interface CuratedRegion {
  id: string;
  name: string;
  province: string;
  description: string;
  disclaimer: string;
  source: string;
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  boundary: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

// 带圈层信息的兴趣点
export interface POIWithLayer extends InterestPoint {
  layerMinutes: number; // 所属最小圈层（分钟）
  index: number; // 全局序号（1-based）
  position: [number, number]; // 地图显示坐标（GCJ-02，[lat, lng]）
}

// 按圈层分组的兴趣点集合
export interface POIByLayer {
  layerMinutes: number;
  color: string;
  fillColor: string;
  points: POIWithLayer[];
}

// 结构化地点检索与覆盖评估结果 (供 #8 IA 使用)
export interface POIQueryResult {
  status: CoverageStatus;
  coverageOverlap: CoverageOverlap;
  isPartial: boolean;
  poiByLayer: POIByLayer[];
  allPOIs: POIWithLayer[];
  matchedRegion: CuratedRegion | null;
  disclaimer: string;
}

// 地点检索参数
export interface QueryInterestPointsOptions {
  isochrones: IsochroneFeature[];
  rangeMinutes?: number[];
  allPoints?: InterestPoint[];
  regions?: CuratedRegion[];
  originCoordinates?: [number, number]; // [lng, lat] (WGS-84)
  landmark?: CityLandmark | null;
}

// ==========================================
// 分享快照契约与导出数据结构 (#10 / #11)
// ==========================================

export interface SharePayloadConditions {
  landmark: CityLandmark;
  profile: TravelProfile;
  rangeMinutes: number[];
  isExample?: boolean;
}

export interface SharePayloadPOIInfo {
  totalPOIs: number;
  poiByLayer: POIByLayer[];
  coverageStatus: CoverageStatus;
  isPartial?: boolean;
}

export interface SharePayload {
  version: 1;
  conditions: SharePayloadConditions;
  isochrones: IsochroneFeature[];
  selectedPOIId: string | null;
  selectedPOI?: POIWithLayer | null;
  poiInfo: SharePayloadPOIInfo;
  createdAt: number;
}

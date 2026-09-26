export interface ImmigrationHall {
  id: string;
  index: number;
  name: string;
  address: string;
  district: string;
  hours: string;
  /** WGS-84 [lng, lat] */
  coordinates: [number, number];
  busGuide?: string;
}

/**
 * 珠海市出入境智能服务厅列表
 * 坐标来源：OpenStreetMap / Overpass，部分为路段中心近似定位
 */
export const zhuhaiImmigrationHalls: ImmigrationHall[] = [
  {
    id: 'zh-imm-1',
    index: 1,
    name: '市公安局出入境管理支队',
    address: '香洲区香华路493号',
    district: '香洲区',
    hours: '24小时',
    coordinates: [113.53372, 22.273884],
    busGuide: '33、99、7、13、62、992、201、206、992A、207、25、3、6、10、11、36、40、60、68、B1、K1，体育中心南站下车',
  },
  {
    id: 'zh-imm-2',
    index: 2,
    name: '珠海市民服务中心公安综合服务一厅',
    address: '香洲区迎宾北路3333号珠海市民服务中心1号楼南楼三楼',
    district: '香洲区',
    hours: '周一至周五 09:00-18:00（法定节假日除外）',
    coordinates: [113.540336, 22.283136],
    busGuide: '市民服务中心总站 / 市民服务中心北站',
  },
  {
    id: 'zh-imm-3',
    index: 3,
    name: '拱北口岸公安局拱北办证点',
    address: '香洲区拱北夏湾路108号',
    district: '香洲区',
    hours: '24小时',
    coordinates: [113.534026, 22.225805],
    busGuide: '夏湾路沿线公交',
  },
  {
    id: 'zh-imm-4',
    index: 4,
    name: '拱北口岸公安局南屏办证点',
    address: '香洲区南屏镇南湾北路33号',
    district: '香洲区',
    hours: '24小时',
    coordinates: [113.501472, 22.229451],
    busGuide: '南湾北路沿线公交',
  },
  {
    id: 'zh-imm-5',
    index: 5,
    name: '金湾市民服务中心公安业务综合大厅',
    address: '金湾区三灶镇金鑫路137号A1座7楼',
    district: '金湾区',
    hours: '周一至周日 07:00-21:00',
    coordinates: [113.35975, 22.118596],
    busGuide: '金湾市民服务中心周边公交',
  },
  {
    id: 'zh-imm-6',
    index: 6,
    name: '三灶派出所',
    address: '金湾区三灶镇河一路166号',
    district: '金湾区',
    hours: '24小时',
    coordinates: [113.339885, 22.051327],
    busGuide: '三灶河一路沿线公交',
  },
  {
    id: 'zh-imm-7',
    index: 7,
    name: '斗门分局出入境中心',
    address: '斗门区井岸镇珠峰大道1236号',
    district: '斗门区',
    hours: '24小时',
    coordinates: [113.319152, 22.204438],
    busGuide: '斗门区市民服务中心 / 行政服务中心站',
  },
  {
    id: 'zh-imm-8',
    index: 8,
    name: '斗门派出所',
    address: '斗门区斗门大道南36号',
    district: '斗门区',
    hours: '24小时',
    coordinates: [113.189917, 22.227354],
    busGuide: '斗门派出所站',
  },
  {
    id: 'zh-imm-9',
    index: 9,
    name: '富山派出所',
    address: '斗门区珠峰大道北3201号',
    district: '斗门区',
    hours: '24小时',
    coordinates: [113.133818, 22.175149],
    busGuide: '富山总站周边公交',
  },
  {
    id: 'zh-imm-10',
    index: 10,
    name: '高栏港分局平沙镇党群服务中心',
    address: '高栏港经济区平沙镇升平大道336号1栋首层',
    district: '高栏港经济区',
    hours: '24小时',
    coordinates: [113.182824, 22.107623],
    busGuide: '平沙镇政府站',
  },
  {
    id: 'zh-imm-11',
    index: 11,
    name: '珠海市金湾区高栏港行政服务中心',
    address: '高栏港经济区南水镇高栏港大道2073号新源大厦一楼公安服务大厅',
    district: '高栏港经济区',
    hours: '周一至周五 09:00-12:00、14:00-18:00（法定节假日除外）',
    coordinates: [113.2355, 22.0255],
    busGuide: '高栏港大道 / 南水镇公交',
  },
  {
    id: 'zh-imm-12',
    index: 12,
    name: '南水派出所',
    address: '高栏港经济区南水镇南港中路22号',
    district: '高栏港经济区',
    hours: '24小时',
    coordinates: [113.2362, 22.032113],
    busGuide: '南港中路沿线公交',
  },
  {
    id: 'zh-imm-13',
    index: 13,
    name: '高新政务服务中心',
    address: '唐家湾镇港乐路1号大洲科技园1栋一楼珠海（国家）高新区政务服务中心公安业务大厅',
    district: '高新区',
    hours: '24小时',
    coordinates: [113.592243, 22.368625],
    busGuide: '大洲科技园 / 港乐路公交',
  },
  {
    id: 'zh-imm-14',
    index: 14,
    name: '金鼎派出所',
    address: '高新区金鼎鸿新街8号',
    district: '高新区',
    hours: '24小时',
    coordinates: [113.530803, 22.383311],
    busGuide: '金鼎市场 / 金鼎站',
  },
  {
    id: 'zh-imm-15',
    index: 15,
    name: '机场派出所',
    address: '珠海机场候机楼',
    district: '金湾区',
    hours: '24小时',
    coordinates: [113.371343, 22.010557],
    busGuide: '珠海机场航站楼',
  },
];

export const hallsByDistrict = zhuhaiImmigrationHalls.reduce(
  (acc, hall) => {
    if (!acc[hall.district]) acc[hall.district] = [];
    acc[hall.district].push(hall);
    return acc;
  },
  {} as Record<string, ImmigrationHall[]>
);

/** 珠海市大致中心（WGS-84） */
export const ZHUHAI_CENTER_WGS84: [number, number] = [113.45, 22.22];

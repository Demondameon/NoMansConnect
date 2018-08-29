const locationItemStyle = {
  padding: '0px 2px',
  margin: '0px 3px',
  background: 'rgba(23, 26, 22, 0.8)',
  fontSize: '16px'
};

const sortStoredByKeyMap = {
  created: 'Time',
  name: 'Name',
  description: 'Description',
  distanceToCenter: 'Distance To Center',
  galaxy: 'Galaxy',
  teleports: 'Popularity'
};

const defaultPosition = {
  playerPosition: [
    233.02163696289063,
    6774.24560546875,
    115.99118041992188,
    1
  ],
  playerTransform: [
    0.35815203189849854,
    0.82056683301925659,
    0.44541805982589722,
    1
  ],
  shipPosition: [
    234.85250854492188,
    6777.2685546875,
    121.86365509033203,
    1
  ],
  shipTransform: [
    -0.48167002201080322,
    -0.84464621543884277,
    -0.23359590768814087,
    1
  ],
};

const saveKeyMapping = {
  Version: 'F2P',
  GameKnowledgeData: 'VuQ',
  Waypoints: 'yRy',
  Address: '2Ak',
  GalaxyWaypointType: 'S8b',
  EventId: 'SSo',
  SpawnStateData: 'rnc',
  LastKnownPlayerState: 'jk4',
  PlayerStateData: '6f=',
  Platform: '8>q',
  UniverseAddress: 'yhJ',
  RealityIndex: 'Iis',
  GalacticAddress: 'oZw',
  VoxelX: 'dZj',
  VoxelY: 'IyE',
  VoxelZ: 'uXE',
  SolarSystemIndex: 'vby',
  PlanetIndex: 'jsv',
  PlayerPositionInSystem: 'mEH',
  PlayerTransformAt: 'l2U',
  ShipPositionInSystem: 'tnP',
  ShipTransformAt: 'l4H',
  FreighterPositionInSystem: 'NGn',
  FreighterTransformAt: 'uAt',
  FreighterTransformUp: '5Sg',
  PersistentPlayerBases: 'F?0',
  Name: 'NKm',
  BaseType: 'peI',
  PersistentBaseTypes: 'DPp',
  Owner: '3?K',
  BaseVersion: 'h4X',
  Position: 'wMC',
  Forward: 'oHw',
  UserData: 'CVX',
  LastUpdateTimestamp: 'wx7',
  Objects: '@ZJ',
  Timestamp: 'b1:',
  ObjectID: 'r<7',
  Up: 'wJ0',
  At: 'aNu',
  Health: 'fSZ',
  ShipHealth: 'KCM',
  Shield: 'kLc',
  ShipShield: 'NE3',
  Energy: 'dcK',
  Units: 'wGS',
  TimeAlive: 'i8O',
  TotalPlayTime: 'Lg8',
  MarkerStack: 'A1f',
  Table: '9@i',
  Event: 'FN5',
  BuildingSeed: '5bU',
  BuildingLocation: 'TWn',
  BuildingClass: 'iqv',
  Time: 'ADw',
  MissionID: 'jGk',
  MissionSeed: '1JW',
  ParticipantType: 'M?f',
  Stats: 'gUR',
  TelemetryStats: 'm4I',
  GroupId: ':rc',
  Id: 'b2n',
  Value: '>MX',
  IntValue: '>vs',
  FloatValue: 'eoL',
  StoredInteractions: 'a6j',
  Interactions: 'O49',
  MaintenanceInteractions: 'RQA',
  PersonalMaintenanceInteractions: 'VhC',
  InventoryContainer: '=yU',
  ValidSlotIndices: 'hl?',
  DamageTimers: '4>;',
  Flags: 'XV5',
  Inventory: ';l5',
  Inventory_TechOnly: 'PMT',
  Slots: ':No',
  Type: 'Vn8',
  InventoryType: 'elv',
  Amount: '1o9',
  MaxAmount: 'F9q',
  DamageFactor: 'eVk',
  Index: '3ZH',
  X: '>Qh',
  Y: 'XJ>',
  PrimaryShip: 'aBE',
  MultiShipEnabled: '@Vn',
  PlayerWeaponName: 'rBG',
  PlayerFreighterName: 'vxi',
  VisitedSystems: 'nwS',
  Hazard: 'seg',
  BoltAmmo: '9Lm',
  ScatterAmmo: 'VPy',
  PulseAmmo: ':ML',
  LaserAmmo: 'cO>',
  FirstSpawnPosition: 'vaP',
  SavedInteractionIndicies: 'E?v',
  SavedRaceIndicies: 'SEK',
  SavedInteractionDialogTable: 'Wu?',
  Hash: 'E=X',
  Dialog: '2Fk',
  InteractionProgressTable: 'wHR',
  AtlasStationAdressData: 'vsV',
  NewAtlasStationAdressData: 'B9>',
  VisitedAtlasStationsData: ':A3',
  FirstAtlasStationDiscovered: ':0x',
  UsesThirdPersonCharacterCam: 'kPF',
  ProgressionLevel: 'DtI',
  ProcTechIndex: 'QNH',
  IsNew: 'eV1',
  UseSmallerBlackholeJumps: 'wc3',
  UsedEntitlements: '<dk',
  PlanetPositions: 'aHM',
  PlanetSeeds: '?=a',
  PrimaryPlanet: '7Mc',
  TimeLastSpaceBattle: '05J',
  WarpsLastSpaceBattle: '8br',
  ActiveSpaceBattleUA: '8xx',
  TimeLastMiniStation: 'IRi',
  WarpsLastMiniStation: 'x=M',
  MiniStationUA: 'gpU',
  AnomalyPositionOverride: 'JvI',
  GameStartAddress1: '5ST',
  GameStartAddress2: 'EeN',
  GalacticMapRequests: 'M2Z',
  FirstShipPosition: 'nTB',
  HazardTimeAlive: 'G?:',
  RevealBlackHoles: 'tSD',
  CurrentFreighterHomeSystemSeed: 'kYq',
  CurrentFreighter: 'bIR',
  Filename: '93M',
  Seed: '@EL',
  AltId: 'QlJ',
  ProceduralTexture: '<d2',
  Samplers: 'bnT',
  FreighterLayout: '>Yh',
  Level: '9;o',
  WeaponInventory: 'Kgt',
  FreighterInventory: '8ZP',
  FreighterInventory_TechOnly: '0wS',
  FreighterUniverseAddress: 'RB7',
  FreighterMatrixAt: '9wg',
  FreighterMatrixUp: 'fUl',
  FreighterMatrixPos: 'lpm',
  BaseBuildingObjects: 'c5s',
  RegionSeed: 'ofi',
  TerrainEditData: '=o:',
  NPCWorkers: '4Km',
  ResourceElement: 'q08',
  InteractionSeed: 'BKy',
  HiredWorker: '1wj',
  FreighterBase: 'gNy',
  BaseUA: 'pNt',
  BaseOffset: 'TJx',
  TeleportEndpoints: 'nlG',
  ShipOwnership: '@Cs',
  Resource: 'NTx',
  StartGameShipPosition: 'h=c',
  TradingSupplyDataIndex: 'nkF',
  TradingSupplyData: 'b69',
  LastPortal: 'HbG',
  VisitedPortal: 'NQJ',
  PortalSeed: '3fO',
  LastPortalUA: 'K:U',
  KnownPortalRunes: 'vrS',
  OnOtherSideOfPortal: 'DaC',
  PortalMarkerPosition_Local: 'LIR',
  PortalMarkerPosition_Offset: 'qW;',
  Class: 'B@N',
  InventoryClass: '1o6',
  SubstanceMaxStorageMultiplier: '0H2',
  ProductMaxStorageMultiplier: 'cTY',
  BaseStatValues: 'bB',
  SpecialSlots: 'MMm',
  Width: '=Tb',
  Height: 'N9>',
  IsCool: 'iF:',
  KnownTech: '4kj',
  KnownProducts: 'eZ<',
  DiscoveryManagerData: 'fDu',
  'DiscoveryData-v1': 'ETO',
  ReserveStore: 'fgt',
  ReserveManaged: 'xxK',
  Store: 'OsQ',
  Record: '?fB',
  DD: '8P3',
  UA: '5L6',
  DT: '<Dn',
  VP: 'bEr',
  DM: 'q9a',
  OWS: 'ksu',
  LID: 'f5Q',
  UID: 'K7E',
  USN: 'V?:',
  TS: '3I1',
  RID: 'B2h',
  FL: '=wD',
  C: 'bLr'
};

module.exports = {locationItemStyle, sortStoredByKeyMap, defaultPosition, saveKeyMapping};
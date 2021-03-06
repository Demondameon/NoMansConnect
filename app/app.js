import {remote} from 'electron';
import fs from 'graceful-fs';
import log from './log';
import watch from 'watch';
import {machineId} from 'node-machine-id';
import state from './state';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import {assignIn, cloneDeep, orderBy, uniqBy, concat, first, isArray, throttle, pick, last} from 'lodash';
import math from 'mathjs';

import Loader from './loader';
import {dirSep, getLastGameModeSave, exc, formatBase, css, tip, fsWorker, ajaxWorker} from './utils';
import pollSaveData from './poll';
import {handleWallpaper, handleUpgrade, baseError, handleSaveDataFailure} from './dialog';
import {each, find, findIndex, map, filter, parseSaveKeys} from './lang';

import baseIcon from './assets/images/base_icon.png';

import {DropdownMenu, SaveEditorDropdownMenu, BaseDropdownMenu, NotificationDropdown} from './dropdowns';
import {
  ImageModal,
  UsernameOverrideModal,
  LocationRegistrationModal,
  RecoveryModal,
  Notification,
  ProfileModal,
  FriendRequestModal,
  BaseRestorationModal,
  LogModal,
  SettingsModal
} from './modals';
import Search from './search';
import Container from './container';
import {defaultPosition} from './constants';

const {dialog} = remote;
let win;

let formatCount = 1;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = state.get();

    this.topAttachedMenuStyle = {
      position: 'absolute',
      maxHeight: '42px',
      zIndex: '99',
      WebkitUserSelect: 'none',
      WebkitAppRegion: 'drag'
    };
    this.titleStyle = {
      position: 'absolute',
      left: '16px',
      top: '5px',
      margin: 'initial',
      WebkitTransition: 'left 0.1s',
      textTransform: 'uppercase'
    };
    this.titleBarControlsStyle = {
      WebkitAppRegion: 'no-drag',
      paddingRight: '0px'
    };
    this.noDragStyle = {
      WebkitAppRegion: 'no-drag'
    };
    this.headerItemClasses = 'ui dropdown icon item';
  }
  componentDidMount() {
    this.connections = [
      state
        .connect('*', (obj) => {
        if (process.env.NODE_ENV === 'development') {
          let stackParts = new Error().stack.split('\n');
          console.log('STATE CALLEE: ', stackParts[6]);
        }
        console.log('STATE INPUT: ', obj);

        if (obj.error) {
          state.displayErrorDialog(obj.error);
          state.error = '';
        }
        if (!obj.search
          && obj.remoteLocations
          && obj.remoteLength > 0
          && state.search.length === 0
          && state.remoteLocations
          && state.remoteLocations.results
          && state.remoteLocations.results.length > 0
          && !state.closing) {
          state.handleMaintenance(obj, (nextObject) => {
            window.jsonWorker.postMessage({
              method: 'set',
              key: 'remoteLocations',
              value: nextObject.remoteLocations,
            });
            this.setState(nextObject, () => state.handleState(obj));
          });
          return;
        }
        this.setState(obj, () => {
          state.handleState(obj);
        });
        console.log(`STATE: `, this.state);
      }),
      state.connect({
        fetchRemoteLocations: () => this.fetchRemoteLocations(1),
        pollSaveData: () => this.pollSaveData(),
        restoreBase: (restoreBase, selected) => this.handleRestoreBase(restoreBase, selected),
        setWaypoint: (location) => this.setWaypoint(location),
        getMonitor: () => this.monitor,
        handleClearSearch: () => this.handleClearSearch(),
        teleport: (...args) => this.handleTeleport(...args)
      })
    ];
    state._init(() => this.init());
  }
  init = () => {
    win = state.trigger('window');
    win.on('maximize', this.handleMaximizeEvent);
    win.on('unmaximize', this.handleMaximizeEvent);
    window.addEventListener('resize', this.onWindowResize);
    log.init(this.state.configDir);
    log.error(`Initializing No Man's Connect ${this.state.version}`);
    if (this.state.offline) {
      log.error(`Offline mode enabled.`);
    }

    // TBD: Work around electron starting in the home directory on Linux
    let modulePath = remote.app.getPath('module').split(dirSep);
    modulePath.pop();
    modulePath = modulePath.join(dirSep);
    window.modulePath = modulePath;

    if (process.env.NODE_ENV === 'production') {
      this.saveJSON = `${remote.app.getPath('userData')}${dirSep}saveCache.json`;
      this.saveTool = `${modulePath}${dirSep}nmssavetool${dirSep}nmssavetool.exe`;
    } else {
      this.saveJSON = `.${dirSep}app${dirSep}nmssavetool${dirSep}saveCache.json`;
      this.saveTool = `.${dirSep}app${dirSep}nmssavetool${dirSep}nmssavetool.exe`;
    }

    handleWallpaper();

    machineId().then((machineId) => {
      ajaxWorker.post('/nmsversion/', {
        version: true,
        machineId,
        username: state.username
      }).then((res) => {
        let {username, version, news, id} = res.data;
        if (version !== this.state.version) {
          handleUpgrade(res.data.version);
        }
        if (news && id !== this.state.newsId) {
          state.set({
            notification: {
              message: news,
              type: 'info'
            },
            newsId: id
          });
        }
        state.set({username, machineId});
        console.log({username})
        this.syncRemoteOwned(username);
      }).catch((err) => {
        if (!err.response && !state.offline) {
          let {title} = state;
          title = title.replace(/CONNECT/, 'DISCONNECT');
          log.error('No response from the server was received, switching to offline mode.');
          state.set({
            title,
            offline: true,
            init: false,
            notification: {
              message: 'Server is temporarily unavailable. Offline mode is now enabled. Sorry for the inconvenience.',
              type: 'info'
            }
          }, true);
          return;
        }
        log.error('Failed to check for newer version: ', err.response);
      });
    });


  }
  componentWillUnmount() {
    win.off('maximize', this.handleMaximizeEvent);
    win.off('unmaximize', this.handleMaximizeEvent);
    if (this.monitor) {
      this.monitor.stop();
    }
    state.destroy();
  }
  checkMods = (cb) => {
    let initialized = false;
    let initialize = () => {
      if (!state.saveDirectory && process.platform !== 'win32') {
        handleSaveDataFailure();
        return;
      }
      if (initialized) {
        return;
      }
      initialized = true;
      this.pollSaveData(this.state.mode, true);
      if (cb) cb();
    };

    let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'X', 'Z'];
    let indexModsInUse = (_path, modPath) => {
      fsWorker.readFile(`${_path}${dirSep}Binaries${dirSep}SETTINGS${dirSep}TKGRAPHICSSETTINGS.MXML`, (err, data) => {
        if (err) {
          log.error('Unable to check NMS settings: ', _path);
          initialize();
          return;
        }
        let fullscreen = null;
        if (data) {
          fullscreen = new Buffer.from(data).toString().split('<Property name="FullScreen" value="')[1].substr(0, 4);
        }
        if (fullscreen === 'true' || err) {
          state.set({autoCapture: false, loading: 'Checking for mods...'});
        }
        let _modPath = `${_path}${modPath}`;
        fsWorker.exists(_modPath, (exists) => {
          if (!exists) {
            log.error('Unable to find mods directory.')
            initialize();
            return;
          }
          fsWorker.readdir(_modPath, (err, list) => {
            if (err) {
              log.error(`Failed to read mods directory: ${err}`);
              initialize();
              return;
            }
            list = filter(list, (item) => {
              return item.toLowerCase().indexOf('.pak') !== -1;
            });
            state.set({mods: list}, () => {
              initialize();
            }, true);
          });
        });
      });
    };

    let modPath = `\\GAMEDATA\\PCBANKS\\MODS`;

    if (process.platform === 'linux') {
      indexModsInUse(state.installDirectory, modPath);
      return;
    }

    let paths = [
      `/Program Files (x86)/GalaxyClient/Games/No Man's Sky`,
      `/Program Files (x86)/Steam/steamapps/common/No Man's Sky`,
      `/Steam/steamapps/common/No Man's Sky`,
      `/steamapps/common/No Man's Sky`,
      `/Program Files/No Man's Sky`,
      `/GOG Games/No Man's Sky`,
      `/Games/No Man's Sky`,
    ];

    if (state.installDirectory) {
      paths = [state.installDirectory.split(':\\')[1]];
    }

    let hasPath = false;
    let args = [];
    let shouldReturn = false;
    each(letters, (drive, key) => {
      each(paths, (_path) => {
        let __path = `${drive}:${_path}`;
        if (fs.existsSync(__path)) {
          hasPath = true;
          args = [__path, modPath];
          shouldReturn = true;
          return false;
        }
      });
      if (shouldReturn) {
        return false;
      }
    });
    if (!hasPath) {
      log.error('Failed to locate NMS install: path doesn\'t exist.')
      initialize();
    } else {
      indexModsInUse(...args);
    }
  }
  syncRemoteOwned = (username) => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    if (!username) username = this.state.username;
    ajaxWorker.get('/nmslocationsync', {
      params: {
        username,
        page_size: 9999
      }
    }).then((res) => {
      let {storedLocations} = this.state;
      storedLocations = uniqBy(concat(storedLocations, res.data.results), 'dataId');
      state.set({
        storedLocations,
        loading: 'Syncing locations...'
      }, () => {
        this.formatRemoteLocations(res, state.page, state.sort, state.init, false, false, () => {
          if (state.init) {
            this.handleSync(1, state.sort, state.init);
            this.checkMods();
          }
        });
      });
    }).catch((err) => {
      console.log(err)
      log.error('Failed to download missing locations from the server: ', err.response);
    });
  }
  handleSync = (page=1, sort=this.state.sort, init=false) => {
    if (this.state.offline || this.state.closing) {
      return;
    }

    if (!state.remoteLocations || !state.remoteLength === 0) {
      return;
    }
    let locations = [];
    each(state.storedLocations, (location) => {
      let existsInRemoteLocations = false;
      each(state.remoteLocations.results, (remoteLocation) => {
        if (location && remoteLocation && remoteLocation.dataId === location.dataId) {
          existsInRemoteLocations = true;
          return false;
        };
      });
      if (!existsInRemoteLocations && location && location.username === this.state.username) {
        locations.push(location);
      }
    });
    ajaxWorker.post('/nmslocationremotecheck/', {
      locations: map(locations, (location) => location.dataId),
      mode: state.mode,
      username: state.username,
    }).then((missing) => {
      missing = missing.data;
      let missingLocations = [];
      each(missing, (dataId) => {
        let location = find(locations, (location) => location.dataId === dataId);
        if (location) {
          missingLocations.push(location);
        }
      });

      let next = () => this.fetchRemoteLocations(page, sort, init, true);

      ajaxWorker.post('/nmslocationremotesync/', {
        locations: missingLocations,
        mode: state.mode,
        username: state.username,
      }).then(() => next()).catch((err) => {
        log.error('Failed to upload missing locations to the server: ', err.response);
        next();
      });
    }).catch((err) => log.error('handleSync: ', err.message));
  }
  formatRemoteLocations = (res, page=1, sort, init, partial, pagination, cb=null) => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    if (!this.state.remoteLocations || this.state.remoteLocations.length === 0) {
      this.state.remoteLocations = {
        results: [],
      };
    }
    if (formatCount > window.coreCount) {
      formatCount = 1;
    }
    let worker = `formatWorker${formatCount}`;

    window[worker].onmessage = (e) => {
      window[worker].onmessage = null;
      console.log('FORMAT WORKER: ', e.data);
      state.set(e.data.stateUpdate);
      if (cb) cb();
    };

    window[worker].postMessage({
      res,
      page,
      sort,
      init,
      partial,
      pagination,
      state: {
        remoteLocations: this.state.remoteLocations,
        remoteLength: this.state.remoteLength,
        remoteNext: this.state.remoteNext,
        search: this.state.search,
        favorites: this.state.favorites,
        storedLocations: this.state.storedLocations,
        pageSize: this.state.pageSize,
        loading: 'Loading remote locations...'
      }
    });
    formatCount++;
  }
  pollRemoteLocations = (init = false) => {
    if (this.timeout)  {
      clearTimeout(this.timeout);
    }

    if (this.state.offline || this.state.closing) {
      return;
    }

    let {sort, pollRate, remoteLocations} = this.state;

    if (sort !== '-created' || (remoteLocations.results && remoteLocations.results.length === 0) || init) {
      this.timeout = setTimeout(() => this.pollRemoteLocations(), pollRate);
      return;
    }

    let orderedRemoteLocations = orderBy(remoteLocations.results, 'created', 'desc');
    let lastRemoteLocation = first(orderedRemoteLocations);

    if (!lastRemoteLocation || !lastRemoteLocation.created) { // Temporary migration workaround
      let i = 0;
      while ((!orderedRemoteLocations[i] || !orderedRemoteLocations[i].created) && i < orderedRemoteLocations.length - 1) {
        i++;
      }
      lastRemoteLocation = orderedRemoteLocations[i];
    }

    let start = new Date(lastRemoteLocation.created);
    let end = new Date();

    let next = () => this.timeout = setTimeout(() => this.pollRemoteLocations(), pollRate);

    ajaxWorker.get('/nmslocationpoll', {
      params: {
        start: start,
        end: end,
        dataId: lastRemoteLocation.dataId
      }
    }).then((res) => {
      if (res.data.results.length > 0 && this.state.search.length === 0) {
        this.formatRemoteLocations(
          res,
          state.page ? state.page : 1,
          state.sort,
          false,
          true,
          state.pagination,
          () => {
            next();
          }
        );
      } else {
        next();
      }
    }).catch((err) => {
      console.log(err)
      log.error('Failed regular polling request: ', err.response);
      next();
    })
  }
  fetchRemoteLocations = (page = this.state.page, sort = this.state.sort, init = false, pagination = false) => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    if (!state.navLoad) {
      state.set({navLoad: true});
    }
    let q = state.search.length > 0 ? state.search : null;
    let path = q ? '/nmslocationsearch' : '/nmslocation';
    sort = sort === 'search' ? '-created' : sort;

    let params = {
      page: page ? page : 1,
      sort: sort,
      q: q
    };

    if (q) {
      params.page_size = q.substr(0, 5) === 'user:' ? 2000 : 200;
    }

    ajaxWorker.get(path, {params}).then((res) => {
      this.formatRemoteLocations(res, page, sort, false, false, pagination && !state.offline, () => {
        if (state.init) {
          state.set({init: false}, true);
          this.pollRemoteLocations(init);
        }
      });
    }).catch((err) => {
      log.error('Failed to fetch remote locations: ', err.response);
      let stateUpdate = {
        remoteLocations: state.remoteLocations,
        navLoad: false,
      };
      if (err.response && err.response.status === 404) {
        stateUpdate.remoteNext = null;
      }
      state.set(stateUpdate);
    });
  }
  handleCheat = (dataId, n) => {
    let currentLocation = find(this.state.storedLocations, location => location.dataId === this.state.currentLocation);
    if (currentLocation) {
      this.handleTeleport(currentLocation, 0, dataId, n);
    }
  }
  handleSaveBase = (baseData=null) => {
    const {storedBases} = this.state;
    if (baseData) {
      storedBases.push(cloneDeep(baseData));
      state.set({storedBases});
      return;
    }
    getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      each(saveData.result.PlayerStateData.PersistentPlayerBases, (base, i) => {
        if (!base.GalacticAddress || !base.Name) {
          return;
        }
        base = formatBase(saveData, state.knownProducts, i);
        let refBase = findIndex(storedBases, _base => _base.Name === base.Name);
        if (refBase === -1 && isArray(storedBases)) {
          storedBases.push(base);
        } else {
          storedBases[refBase] = base;
        }
        state.set({storedBases});
      });
    }).catch(baseError);
  }
  _signSaveData = (absoluteSaveDir, slot, cb) => {
    let command = `${process.platform !== 'win32' ? 'wine ' : ''}"${this.saveTool}" encrypt -g ${slot} -f "${this.saveJSON}" --save-dir "${absoluteSaveDir}"`;
    console.log(command);
    exc(command).then((res) => {
      log.error('Successfully signed save data with nmssavetool.');
      if (typeof cb === 'function') cb();
    }).catch((e) => {
      if (process.platform !== 'win32') {
        log.error('Unable to re-encrypt the metadata file with nmssavetool.exe. Do you have Wine with the Mono runtime installed?');
      }
      log.error('_signSaveData: ', e);
    });
  }
  signSaveData = (saveData, cb) => {
    let absoluteSaveDir = this.state.saveFileName.split(dirSep);
    let _absoluteSaveDir = absoluteSaveDir.slice();
    absoluteSaveDir.splice(absoluteSaveDir.length - 1, 1);
    absoluteSaveDir = absoluteSaveDir.join(dirSep);

    if (saveData.needsConversion) {
      saveData.result = parseSaveKeys(saveData.result, true);
    }

    fsWorker.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
      if (err) {
        log.error('Error occurred while attempting to write save file cache:');
        log.error(err);
        state.set({navLoad: false});
        return;
      }
      if (!this.state.backupSaveFile) {
        log.error('Skipping save file backup because option is disabled in settings.');
        this._signSaveData(absoluteSaveDir, saveData.slot, cb);
        return;
      }
      fsWorker.backupSaveFile(
        absoluteSaveDir,
        last(_absoluteSaveDir),
        (err) => {
          if (err) {
            log.error('Unable to backup save file before writing: ', err);
            state.set({navLoad: false});
            return;
          }
          log.error('Successfully backed up save file.');
          this._signSaveData(absoluteSaveDir, saveData.slot, cb);
        }
      );
    });
  }
  handleRestoreBase = (base, confirmed = false) => {
    state.set({navLoad: true});
    getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      const {PersistentPlayerBases} = saveData.result.PlayerStateData
      if (confirmed === false) {
        state.set({
          displayBaseRestoration: {
            savedBases: PersistentPlayerBases,
            restoreBase: base
          },
          navLoad: false
        });
        return;
      }
      if (PersistentPlayerBases.length === 0) {
        baseError();
        return;
      }
      if (!confirmed || typeof confirmed !== 'object') {
        log.error('Base restoration cancelled - unable to get index of base to be replaced.');
        return;
      }
      let refIndex = findIndex(PersistentPlayerBases, (base) => base.Name === confirmed.Name);
      let newBase = PersistentPlayerBases[refIndex];
      let storedBase = cloneDeep(base);

      log.error(`Restoring base ${base.Name} over ${confirmed.Name}`);

      // Base conversion algorithm by monkeyman192

      // 3-vector
      let fwdOriginal = storedBase.Forward;
      // 3-vector
      let upOriginal;
      if (storedBase.Objects.length > 0) {
        upOriginal = last(storedBase.Objects).Up;
      } else {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Base Restore',
          message: 'In order to restore your base correctly, at least one base building object must be placed on the new base first.'
        });
        state.set({navLoad: false});
        return;
      }
      // cross is defined in the math.js library.
      let perpOriginal = math.cross(fwdOriginal, upOriginal);

      // This creates  3rd vector orthogonal to the previous 2 to create a set of linearly independent basis vectors
      // this is a matrix made up from the other 3 vectors as columns
      let P = math.matrix([[fwdOriginal[0], upOriginal[0], perpOriginal[0]],
        [fwdOriginal[1], upOriginal[1], perpOriginal[1]],
        [fwdOriginal[2], upOriginal[2], perpOriginal[2]]]);

      // now read the new data, ensuring the user has created at least one Object to read data from (need that Up value!)
      // 3-vector
      let fwdNew = newBase.Forward;
      // 3-vector
      let upNew;
      if (newBase.Objects.length > 0) {
        upNew = last(newBase.Objects).Up;
      } else {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Base Restore',
          message: 'In order to restore your base correctly, at least one base building object must be placed on the old base first.'
        });
        return;
      }
      let perpNew = math.cross(fwdNew, upNew);

      // again, we construct a matrix from the column vectors:
      let Q = math.matrix([[fwdNew[0], upNew[0], perpNew[0]],
              [fwdNew[1], upNew[1], perpNew[1]],
              [fwdNew[2], upNew[2], perpNew[2]]]);

      // our final transform matrix is now equal to:
      let M = math.multiply(Q, math.inv(P))

      each(storedBase.Objects, (object, i) => {
        storedBase.Objects[i].At = math.multiply(M, object.At)._data
        storedBase.Objects[i].Up = upNew;
        storedBase.Objects[i].Position = math.multiply(M, object.Position)._data;
      });

      saveData.result.PlayerStateData.PersistentPlayerBases[refIndex].Objects = storedBase.Objects;

      this.signSaveData(saveData, () => state.set({displayBaseRestoration: null, navLoad: false}));
    }).catch((err) => {
      log.error(`Failed to restore base: ${err.message}`);
      state.set({navLoad: false});
    });
  }
  handleTeleport = (location, i, action = null, n = null) => {
    const _location = cloneDeep(location);
    state.set({navLoad: true});
    getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {

      if (action && typeof action === 'object' && action.playerPosition) {
        assignIn(_location, action);
      }

      if (location.manuallyEntered) {
        assignIn(_location, defaultPosition);
        saveData.result.SpawnStateData.LastKnownPlayerState = 'InShip';
      }

      assignIn(saveData.result.SpawnStateData, {
        PlayerPositionInSystem: _location.playerPosition,
        PlayerTransformAt: _location.playerTransform,
        ShipPositionInSystem: _location.shipPosition,
        ShipTransformAt: _location.shipTransform
      });

      assignIn(saveData.result.PlayerStateData.UniverseAddress.GalacticAddress, {
        PlanetIndex: _location.PlanetIndex,
        SolarSystemIndex: _location.SolarSystemIndex,
        VoxelX: _location.VoxelX,
        VoxelY: _location.VoxelY,
        VoxelZ: _location.VoxelZ
      });

      if (typeof action === 'string') {
        saveData.result = utils[action](saveData, n);
      }

      saveData.result.PlayerStateData.UniverseAddress.RealityIndex = _location.galaxy;

      this.signSaveData(saveData, () => {
        state.set({currentLocation: _location.dataId});
        ajaxWorker.post('/nmslocation/', {
          machineId: this.state.machineId,
          username: this.state.username,
          teleports: true,
          dataId: _location.dataId,
          action: 1
        }).then((res) => {
          let {remoteLocations, selectedLocation} = this.state;
          let refRemoteLocation = findIndex(remoteLocations.results, (remoteLocation) => {
            return remoteLocation.dataId === _location.dataId;
          });
          if (refRemoteLocation > -1) {
            remoteLocations.results[refRemoteLocation] = res.data;
          }
          if (selectedLocation && selectedLocation.dataId === _location.dataId) {
            selectedLocation = res.data;
          }

          state.set({
            navLoad: false,
            remoteLocations,
            selectedLocation
          });
        }).catch((err) => {
          log.error(`Unable to send teleport stat to server: ${err}`);
          state.set({navLoad: false});
        });
      });
    }).catch((err) => {
      log.error('Unable to teleport to location:');
      log.error(err);
      state.set({navLoad: false});
    });
  }
  setWaypoint = (location) => {
    log.error('Setting waypoint:', location.dataId);
    state.set({navLoad: true});
    getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      let {Waypoints} = saveData.result.GameKnowledgeData;
      if (!Waypoints) Waypoints = [];
      let {PlanetIndex, SolarSystemIndex, VoxelX, VoxelY, VoxelZ} = location;
      let waypoint = {
        Address: {
          PlanetIndex,
          SolarSystemIndex,
          VoxelX,
          VoxelY,
          VoxelZ
        },
        EventId: '^',
        Type: {
          GalaxyWaypointType: 'User'
        }
      };
      let userWaypoint = findIndex(Waypoints, (wp) => {
        return wp.Type.GalaxyWaypointType === 'User';
      });
      if (userWaypoint > -1) {
        Waypoints[userWaypoint] = waypoint;
      } else {
        Waypoints.push(waypoint);
      }
      saveData.result.GameKnowledgeData.Waypoints = Waypoints;
      this.signSaveData(saveData, () => state.set({navLoad: false}));
    }).catch((err) => {
      log.error('Unable to set waypoint for location: ');
      log.error(err);
    })
  }
  pollSaveData = (mode=this.state.mode, init=false, machineId=this.state.machineId) => {
    if (!state.ready) {
      return;
    }
    let now = Date.now();
    if ((now - this.lastPoll) < 15000) return;
    this.lastPoll = now;

    pollSaveData({mode, init, machineId, next: (error = false, ...args) => {
      if (error) {
        log.error(`getLastSave -> next -> ${error}`);
      }
      if (init) {
        if (!state.ps4User) {
          if (!this.monitor) {
            watch.createMonitor(state.saveDirectory, {
              ignoreDotFiles: true,
              ignoreNotPermitted: true,

            }, (monitor) => {
              this.monitor = monitor;
              this.monitor.on('changed', (f, curr, prev) => {
                this.pollSaveData();
              });
            });
          }
          if (state.username.toLowerCase() === 'explorer') {
            state.set({usernameOverride: true});
          }
        }
        return;
      }
      this.fetchRemoteLocations(1, state.sort, init);
    }});
  }
  handleRemoveStoredLocation = () => {
    if (this.state.selectedLocation.dataId === this.state.currentLocation) {
      log.error('Failed to remove stored location: cannot remove the player\'s current location.');
      return;
    }
    let refStoredLocation = findIndex(state.storedLocations, location => location.dataId === state.selectedLocation.dataId);
    let isOwnLocation = state.storedLocations[refStoredLocation].username === state.username;
    if (isOwnLocation) {
      state.storedLocations[refStoredLocation].isHidden = !state.storedLocations[refStoredLocation].isHidden;
      state.selectedLocation.isHidden = state.storedLocations[refStoredLocation].isHidden;
    } else {
      state.storedLocations.splice(refStoredLocation, 1);
    }
    state.set({
      storedLocations: state.storedLocations,
      selectedLocation: state.selectedLocation.isHidden || !isOwnLocation ? null : state.selectedLocation
    });
  }
  stateChange = (e) => {
    this.setState(e);
  }
  onWindowResize = () => {
    let now = Date.now();
    if ((now - this.lastMove) < 60) return;
    this.lastMove = now;
    state.set({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }
  handleSort = (e, sort) => {
    sort = typeof sort === 'string' ? sort : '-created';
    state.set({sort: sort, navLoad: true}, () => {
      this.fetchRemoteLocations(1, sort, false, true);
    });
  }
  handleSearch = () => {
    if (this.state.offline) {
      let searchCache = filter(this.state.remoteLocations.results, (location) => {
        return (location.dataId === this.state.search
          || location.translatedId === this.state.search
          || location.username === this.state.search
          || location.name.indexOf(this.state.search) > -1
          || location.description.indexOf(this.state.search) > -1)
      });
      state.set({
        searchInProgress: true,
        searchCache: {
          results: searchCache,
          count: searchCache.length,
          next: null,
          prev: null
        }
      });
    } else {
      this.fetchRemoteLocations(1);
    }
  }
  handleClearSearch = () => {
    if (!this.state.offline) {
      let diff = [];
      each(this.state.searchCache.results, (location) => {
        let refRemoteLocation = findIndex(this.state.remoteLocations.results, _location => _location.dataId === location.dataId);
        if (refRemoteLocation === -1) {
          diff.push(location);
        }
      });
      this.state.remoteLocations.results = concat(this.state.remoteLocations.results, uniqBy(diff, (location) => {
        return location.dataId;
      }));
    }

    state.set({
      search: '',
      searchCache: {
        results: [],
        count: 0,
        next: null,
        prev: null
      },
      remoteLocations: this.state.remoteLocations,
      searchInProgress: false,
      sort: '-created'
    });
  }
  handlePagination = () => {
    let page = state.page === 1 ? 2 : state.page + 1;
    state.set({page: page, navLoad: true}, () => {
      this.fetchRemoteLocations(state.page, state.sort, false, true);
    });
  }
  handleMaximize = () => {
    let maximized = win.isMaximized();
    if (maximized) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
  handleMaximizeEvent = () => {
    let maximized = win.isMaximized();
    state.set({maximized});
  }
  handleMinimize = () => {
    win.minimize();
  }
  handleClose = () => {
    if (this.monitor && !module.hot) {
      this.monitor.stop();
    }
    state.set({closing: true});
    setTimeout(() => win.close(), 500);
  }
  handleSearchIconClick = () => {
    if (this.state.searchInProgress) {
      this.handleClearSearch();
    } else {
      this.handleSearch();
    }
  }
  handleSetUsernameOverride = () => {
    state.set({usernameOverride: true});
  }
  handleLocationRegistrationToggle = () => {
    state.set({registerLocation: !this.state.registerLocation});
  }
  render() {
    var s = this.state;
    return (
      <div>
        <div className="ui top attached menu" style={this.topAttachedMenuStyle}>
          <h2 style={this.titleStyle}>{s.title}</h2>
          <div className="right menu">
            {!s.init && s.navLoad ? <Loader loading={null} /> : null}
            {!s.init && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-created' ? ' selected' : ''}`}
            onClick={(e) => this.handleSort(e, '-created')}>
              Recent
            </div> : null}
            {!s.init && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-teleports' ? ' selected' : ''}`}
            onClick={(e) => this.handleSort(e, '-teleports')}>
              Popular
            </div> : null}
            {!s.init  && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-score' ? ' selected' : ''}`}
            onClick={(e) => this.handleSort(e, '-score')}>
              Favorites
            </div> : null}
            {!s.init ?
            <Search
            onKeyDown={this.handleSearch}
            style={this.searchIconStyle}
            onClick={this.handleSearchIconClick}
            search={s.search} /> : null}
            {this.state.profile && this.state.profile.notifications && this.state.profile.notifications.length > 0 ?
            <NotificationDropdown
            machineId={this.state.machineId}
            username={this.state.username}
            options={this.state.profile.notifications}
            height={this.state.height} /> : null}
            {!s.ps4User ?
            <BaseDropdownMenu
            onSaveBase={this.handleSaveBase}
            onRestoreBase={this.handleRestoreBase}
            baseIcon={baseIcon}
            storedBases={this.state.storedBases}
            /> : null}
            {s.profile && !s.ps4User && s.displaySaveEditor ?
            <SaveEditorDropdownMenu
            onSaveBase={this.handleSaveBase}
            onRestoreBase={this.handleRestoreBase}
            profile={s.profile}
            onCheat={this.handleCheat} /> : null}
            <a
            style={css(this.noDragStyle, {cursor: 'default'})}
            className={`ui icon item`}
            onClick={this.handleLocationRegistrationToggle}
            data-place="bottom"
            data-tip={tip('Manually Register Location')}>
              <i className="location arrow icon" />
            </a>
            <DropdownMenu s={s} />
          </div>
          <div
          style={this.titleBarControlsStyle}
          className={this.headerItemClasses}
          onClick={this.handleSort}>
            <div className="titlebar-controls">
              <div className="titlebar-minimize" onClick={this.handleMinimize}>
                <svg x="0px" y="0px" viewBox="0 0 10 1">
                  <rect fill="#FFFFFF" width="10" height="1" />
                </svg>
              </div>
              <div className="titlebar-resize" onClick={this.handleMaximize}>
                {!s.maximized ?
                <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <path fill="#FFFFFF" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z " />
                </svg>
                :
                <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <mask id="Mask">
                    <path fill="#FFFFFF" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z" />
                    <path fill="#FFFFFF" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z" />
                  </mask>
                  <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)" />
                </svg>}
              </div>
              <div className="titlebar-close" onClick={this.handleClose}>
                <svg x="0px" y="0px" viewBox="0 0 10 10">
                  <polygon fill="#FFFFFF" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        {this.state.selectedImage ? <ImageModal image={this.state.selectedImage} width={this.state.width} /> : null}
        {this.state.usernameOverride ? <UsernameOverrideModal ps4User={this.state.ps4User} /> : null}
        {this.state.registerLocation ? <LocationRegistrationModal s={pick(this.state, ['machineId', 'username', 'height', 'storedLocations'])} /> : null}
        {this.state.setEmail ?
        <RecoveryModal
        type="setEmail"
        placeholder="Recovery Email Address"
        s={pick(this.state, ['machineId', 'username', 'profile'])} /> : null}
        {this.state.recoveryToken ?
        <RecoveryModal
        type="recoveryToken"
        placeholder="Recovery Token"
        s={pick(this.state, ['machineId', 'username', 'profile'])} /> : null}
        {s.init ?
        <Loader loading={this.state.loading} />
        :
        <Container
        s={s}
        onPagination={this.handlePagination}
        onRemoveStoredLocation={this.handleRemoveStoredLocation}
        onSaveBase={this.handleSaveBase}
        onSearch={this.handleSearch} />}
        {this.state.displayProfile ?
        <ProfileModal
        username={this.state.username}
        machineId={this.state.machineId}
        profileId={this.state.displayProfile}
        profile={this.state.profile}
        height={this.state.height}
        favorites={this.state.favorites} /> : null}
        {this.state.displayFriendRequest ?
        <FriendRequestModal
        notification={this.state.displayFriendRequest}
        profile={this.state.profile}
        username={this.state.username}
        machineId={this.state.machineId} /> : null}
        {this.state.displayBaseRestoration ?
        <BaseRestorationModal
        baseData={this.state.displayBaseRestoration}
        height={this.state.height} /> : null}
        {this.state.displayLog ? <LogModal  /> : null}
        {this.state.displaySettings ? <SettingsModal
        s={s}
        onSync={this.handleSync}
        onUsernameOverride={this.handleSetUsernameOverride} /> : null}
        <ReactTooltip
        className="nmcTip"
        globalEventOff="click mouseleave"
        effect="solid"
        place="bottom"
        multiline={false}
        html={true}
        offset={{top: 0, left: 6}}  />
        {this.state.notification && this.state.notification.message ?
        <Notification notification={this.state.notification} /> : null}
      </div>
    );
  }
};

export default App;
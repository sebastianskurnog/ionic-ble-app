import {Component, NgZone} from '@angular/core';
import {Events, NavController, ToastController, LoadingController} from 'ionic-angular';
import {AddDevicePage} from "../add-device/add-device";

import { Storage } from '@ionic/storage';
import {BLE} from "@ionic-native/ble";
import {EditDevicePage} from "../edit-device/edit-device";


// Bluetooth UUIDs
const NORDIC_SERVICE = '00001523-1212-efde-1523-785feabcd123';
const NORDIC_CHARACTERISTIC = '00001525-1212-efde-1523-785feabcd123';

// public name of your devices - app will show only devices with that name
const DEVICES_NAME_BRAND = 'Name';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})



/**
 * HomePage class
 *
 * Class is responsible for showing devices list: (get devices from storage, scan fot BLE devices and get statuses + connect to devices).
 * On/off actions is available directly from list.
 *
 */

export class HomePage {

  public storageDevices = [];
  public devicesFromBLE = [];

  private loader = null;

  public availableDevices = [];

  public notAvailableDevices = [];

  public connectedDevices = [];

  public disconnectedDevices = [];

  public inRefreshingMode = true;

  public shuttersWorking = [];

  constructor(public navCtrl: NavController,
              public loadingCtrl: LoadingController,
              private storage: Storage,
              public events: Events,
              private toastCtrl: ToastController,
              private ngZone: NgZone,
              private ble: BLE

  ) {


    events.subscribe('device:action', (type, object) => {

      let message;

      switch (type) {
        case 'add':

          this.inRefreshingMode = true;

          //open loader
          this.presentLoading("Searching for devices...");

          // build array witch devices from storage
          this.getDevicesFromStorage(false).then(()=> {

            // connect
            this.connect(object.mac).then(() => {

              // get statuses
              this.getDataFromConnectedDevices(object.mac, object.type).then(() => {
                // check if devices from storage is connected
                let index = this.connectedDevices.findIndex(x => x.mac == object.mac);
                if (index !== -1) {
                  this.ngZone.run(() => {

                    // build device object
                    if (object.type === 'switch') {
                      let objectToPush = {
                        mac: object.mac,
                        name: object.name,
                        channel1: this.connectedDevices[index].channel1,
                        channel2: this.connectedDevices[index].channel2,
                        channel1name: object.channel1name,
                        channel2name: object.channel2name,
                        type: object.type
                      };
                      // add to avalaible list
                      this.availableDevices.unshift(objectToPush);
                    } else if (object.type === 'shutter') {
                      let objectToPush = {
                        mac: object.mac,
                        name: object.name,
                        shutter_status: this.connectedDevices[index].shutter_status,
                        type: object.type
                      };
                      // add to avalaible list
                      this.availableDevices.unshift(objectToPush);
                    }

                    console.log(this.availableDevices);

                    this.inRefreshingMode = false;

                    // listening for connections (working in background)
                    this.listeningForConnections();

                    // close loader
                    this.loader.dismiss();
                  });
                }
              });
            }, ()=> {
              this.loader.dismiss();
              this.showMessage('Cannot connect to device');
            });
          });

          message = 'New device has been added...';
          break;

        case 'update':

          let index2 = this.availableDevices.findIndex(x => x.mac==object.mac);
          let index3 = this.notAvailableDevices.findIndex(x => x.mac==object.mac);

          this.ngZone.run(() => {
            if (index2 !== -1) {
              this.availableDevices[index2].name = object.name;
              if(object.type === 'switch') {
                this.availableDevices[index2].channel1name = object.channel1name;
                this.availableDevices[index2].channel2name = object.channel2name;
              }
            }
            else if (index3 !== -1) {
              this.notAvailableDevices[index3].name = object.name;
            }


          });
          message = 'Device updated...';
          break;

        case 'delete':

          let index4 = this.availableDevices.findIndex(x => x.mac==object.mac);
          let index5 = this.notAvailableDevices.findIndex(x => x.mac==object.mac);
          let index6 = this.connectedDevices.findIndex(x => x.mac==object.mac);
          let index7 = this.disconnectedDevices.findIndex(x => x.mac==object.mac);

          if (index4 !== -1) {
            this.availableDevices.splice(index4, 1);

          }
           if (index5 !== -1) {
            this.notAvailableDevices.splice(index5, 1);
          }

           if (index6 !== -1) {
            this.connectedDevices.splice(index6, 1);
          }

          if (index6 !== -7) {
            this.disconnectedDevices.splice(index7, 1);
          }

          this.ngZone.run(() => {

            let index8 = this.storageDevices.findIndex(x => x.mac==object.mac);
            if (index8 !== -1) {
              this.storageDevices.splice(index8, 1);
            }

          });


          this.ble.isConnected(object.mac).then(
            () => {
              // jest polaczony
              this.ble.disconnect(object.mac);

            },

            () => {

            });


          // + ble, + disconnect + usun z connected



          message = 'Device deleted...';
          break;
      }

      this.showMessage(message);


    });



    // build array witch devices from storage
    this.getDevicesFromStorage().then(()=> {

      // work only if storage have more than 0 devices
      if(this.storageDevices.length > 0) {

        // show loader
        this.presentLoading("Searching for devices...");

        // scan and build devices list from BLE
        this.getDevicesFromBLE().then(()=> {

          // connect (build connections list)
          this.connectToDevices().then(() => {


            //get statuses (from connection list)
            this.getDataFromConnectedDevices().then(()=> {

              // build abalaible and notavalaible list from conection list (compare with storage)
              this.buildDevicesListToWork().then(()=> {
                this.loader.dismiss();

                this.inRefreshingMode = false;
                // listening for connections (work in background)
                this.listeningForConnections();
              });

            });

           });


        });

      }

    });

  }


  refresh() {

    if(this.storageDevices.length > 0) {

      this.inRefreshingMode = true;

        // show loader
        this.presentLoading("Searching for devices...");

        // scan and build devices list from BLE
        this.getDevicesFromBLE().then(()=> {

          // connect (build connection list)
          this.connectToDevices().then(() => {

            //get statuses (from connection list)
            this.getDataFromConnectedDevices().then(()=> {

              // build abalaible list and notavalaible list from connection list (compare with storage)
              this.buildDevicesListToWork().then(()=> {

                this.loader.dismiss();

                this.inRefreshingMode = false;
              });

            });

          });

        });

    } else {
      this.showMessage('You have not added any devices..');
    }


  }


  getDevicesFromStorage(clearAvalaibleDevices = true): Promise<any> {


    return new Promise((resolve, reject) => {
      this.storageDevices = [];

      if(clearAvalaibleDevices === true) {
        this.availableDevices = [];
      }

      // if storage ready
      this.storage.ready().then(() => {

        // work in zone
        this.ngZone.run(() => {

          // foreach through whole storage
          this.storage.forEach((value) => {

            // add device data from storage to array
            this.storageDevices.push(value);

            this.storage.length().then((data) => {
              if (data == this.storageDevices.length) {
                resolve();
              }
            });

          });

        });

      });

    });

  }


  getDevicesFromBLE(clearExistingResultBeforeStart = null, specific = null): Promise<any> {

    return new Promise((resolve, reject) => {


      // create list from scratch
      if (specific === null) {


        if(clearExistingResultBeforeStart === null) {
          this.devicesFromBLE = [];
        }


        this.ble.startScanWithOptions([],
          { reportDuplicates: false }).subscribe(
          device => {


            let position = this.devicesFromBLE.indexOf(device.id);
            // if there is no on BLE list
            if (!~position) {
              // if there is no in storage list
              let index = this.storageDevices.findIndex(x => x.mac==device.id);
              if (index !== -1) {
                this.onDeviceDiscovered(device)
              }
            }

          },

          errorMessage => {
            this.scanError(errorMessage)
          }
        );
      }
      // try to create specific one more time (when advertising is no readable)
      else {
        this.ble.startScanWithOptions([],
          { reportDuplicates: false }).subscribe(
          (device) => {
            if (device.id == specific) {
              // jesli nie ma jeszce na liscie BLE
              let position = this.devicesFromBLE.indexOf(device.id);
              if (!~position) {
                this.onDeviceDiscovered(device)
              }
            }
          },

          errorMessage => {
            this.scanError(errorMessage)
          }
        );
      }


      if(this.disconnectedDevices.length >0) {

        this.disconnectedDevices.forEach((value) => {

          this.devicesFromBLE.push({mac: value.mac})

        });

      }


      setTimeout(()=> {
        resolve();
      }, 8000);

    });
  }



  buildDevicesListToWork(): Promise<any> {

    return new Promise((resolve, reject) => {


      console.log(this.connectedDevices);


      this.availableDevices = [];
      this.notAvailableDevices = [];

      this.ngZone.run(() => {

        // foreach trough whole storage devices
        this.storageDevices.forEach((value, i) => {

          // check if devices from storage is connected
          let index = this.connectedDevices.findIndex(x => x.mac == value.mac);
          if (index !== -1) {

                if(value.type === 'switch') {
                  // build device object
                  let object = {
                    mac: value.mac,
                    name: value.name,
                    channel1: this.connectedDevices[index].channel1,
                    channel2: this.connectedDevices[index].channel2,
                    channel1name: value.channel1name,
                    channel2name: value.channel2name,
                    type: value.type,
                  };

                  // add to available list
                  this.availableDevices.push(object);

                } else if(value.type === 'shutter') {
                  // build device object
                  let object = {
                    mac: value.mac,
                    name: value.name,
                    shutter_status: this.connectedDevices[index].shutter_status,
                    type: value.type,
                  };

                  // add to available list
                  this.availableDevices.push(object);
                }

                // usun z disconnected
            let index2 = this.disconnectedDevices.findIndex(x => x.mac == value.mac);
            if (index2 !== -1) {
              this.disconnectedDevices.splice(index2, 1);
            }


          } else {

            // build object
            let object = {
              mac: value.mac,
              name: value.name,
              type: value.type
            };

            // add to not available list
            this.notAvailableDevices.push(object);

          }

          // promise resolve condition
          if (this.storageDevices.length - 1 === i) {

            resolve();

          }


        });

      });


    });

  }



  onDeviceDiscovered(device) {

    console.log('Discovered ' + JSON.stringify(device, null, 2));

      // check if name contain brand name string - show only brand devices
      if (device.name.match(DEVICES_NAME_BRAND)) {

        // add object to array
        this.devicesFromBLE.push ({
          mac: device.id
        });

        let index = this.availableDevices.findIndex(x => x.mac == device.id);
        let index2 = this.notAvailableDevices.findIndex(x => x.mac == device.id);

        if (index === -1 && index2 !== -1) {
          this.connectAgain(device.id);
        }


      }
  }



  decodeAdvertising(advertising): Promise<any> {

    return new Promise((resolve, reject) => {
      let decodedAdvertising = String.fromCharCode.apply(null, new Uint8Array(advertising));
      resolve(decodedAdvertising);
    });

  }


  async getAdvertising(advertising) {
    return await this.decodeAdvertising(advertising);
  }




  decodeSwitchChannelsStatusesFromCode(code) {
    let channel1Status = false;
    let channel2Status = false;

    if (code.match('default_10') || code.match('switch_10')) {
      channel1Status = false;
      channel2Status = true;
    }

    if (code.match('default_01') || code.match('switch_01')) {
      channel1Status = true;
      channel2Status = false;
    }

    if (code.match('default_11') || code.match('switch_11')) {
      channel1Status = true;
      channel2Status = true;
    }

    if (code.match('default_03') || code.match('switch_03')) {
      channel1Status = true;
      channel2Status = true;
    }

    else if (code.match('default_02') || code.match('switch_02')) {
      channel1Status = false;
      channel2Status = true;
    }

    else if (code.match('default_00') || code.match('switch_00')) {
      channel1Status = false;
      channel2Status = false;
    }


  //  console.log(code);
    console.log(channel1Status + '-------' + channel2Status);

    return [channel1Status, channel2Status];

  }


  scanError(error) {
    let toast = this.toastCtrl.create({
      message: 'Error scanning for Bluetooth low energy devices',
      position: 'bottom',
      duration: 5000
    });
    toast.present();
  }

  // go to devicePage
  goToAddDevicePage(){
    this.navCtrl.push(AddDevicePage);
  }


  // show popup message
  public showMessage(message) {
    let toast = this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }


  /// TEMP
  public removeAll()
  {
    this.storage.clear();

  }


  presentLoading(message, duration = null) {

    if(duration === null) {

      this.loader = this.loadingCtrl.create({
        content: message
      });

    } else {

      this.loader = this.loadingCtrl.create({
        content: message,
        duration: duration
      });


    }

    this.loader.present();


  }

  editDevice(mac) {
    this.navCtrl.push(EditDevicePage, {
      mac: mac
    });
  }



  // TOGGLE SWITCH

  onPowerSwitchChange(event, channel1, channel2, mac) {

    // prepere data binary array
    let data = new Uint8Array(1);


    // build value to send

        if(channel1 === true && channel2 === false) {
          data[0] = 0b01;

        }

        else if(channel1 === false && channel2 === true) {
          data[0] = 0b10;

        }

        else if(channel1 === true && channel2 === true) {
          data[0] = 0b11;

        }

        else if(channel1 === false && channel2 === false) {
          data[0] = 0b00;

        }


    this.ble.isConnected(mac).then(
      () => {
        this.ble.write(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC, data.buffer).then(
          () => //this.showMessage('Status changed'),
          e => this.showMessage('Unexpected Error' + e)
        );
      },
      () => {
        this.ble.connect(mac).subscribe(
          peripheral => {

            console.log('Power Switch Property ' + status);
            this.ble.write(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC, data.buffer).then(
              () => //this.showMessage('Zmieniono status'),
              e => this.showMessage('Error when try change status')
            );
          },
          peripheral => this.showMessage('Disconnected ' + peripheral)
        );

      }
    );

  }



  connect(mac, noMessage = null): Promise<any>{

   return new Promise((resolve, reject) => {

      this.ble.isConnected(mac).then(
      () => {
        // is connected
        resolve();
        console.log('Connected to ' + mac);
      },
      () => {
        // connect
        this.ble.connect(mac).subscribe(
          peripheral => {
            resolve(peripheral);
          },
          peripheral =>  {
            // cannot connect
            reject();

            if(noMessage === null) {
            //  this.showMessage('Disconnected  ' + mac);
            }


            this.ngZone.run(() => {

              // check if exist on available list
              let index2 = this.availableDevices.findIndex(x => x.mac == mac);
              if (index2 !== -1) {

                // add to disconnected list
                this.disconnectedDevices.push(this.availableDevices[index2]);

                // add to not available list
                this.notAvailableDevices.push({
                  mac: this.availableDevices[index2].mac,
                  name: this.availableDevices[index2].name
                });

                // delete from available list
                this.availableDevices.splice(index2, 1);
              }

              // check if exist on connected list and delete
              let index = this.connectedDevices.findIndex(x => x.mac == mac);
              if (index !== -1) {
                this.connectedDevices.splice(index, 1);
              }

            });

            }
        );

      }
     );

   });

  }



  getStatusesFromCharacteristic(mac): Promise<any> {


    return new Promise((resolve, reject) => {

        let deviceType;

        let index = this.storageDevices.findIndex(x => x.mac == mac);
        if (index !== -1) {
          deviceType = this.storageDevices[index].type;
        }

      console.log("Type to " + deviceType);


      if (deviceType !== 'undefined') {

        this.ble.read(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC).then(
          (buffer) => {
            let data = new Uint8Array(buffer);


            if(deviceType === 'switch') {
              let result = [];

              switch (data[0]) {


                case 0:

                  result['channel1'] = false;
                  result['channel2'] = false;

                  break;

                case 1:

                  result['channel1'] = true;
                  result['channel2'] = false;

                  break;

                case 2:

                  result['channel1'] = false;
                  result['channel2'] = true;

                  break;

                case 3:

                  result['channel1'] = true;
                  result['channel2'] = true;

                  break;


              }

              if(typeof result['channel1'] === "boolean") {
                resolve(result);
              }

            } else if(deviceType === 'shutter') {

              console.log("Typ shutter status " + data[0]);

              let status;

              switch (data[0]) {

                case 1:
                status = 1;
                break;

                case 2:
                  status = 2;
                  break;

                case 3:

                 // wait 5 seconds and connect again

                  setTimeout(()=> {

                    this.ble.read(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC).then(
                      (buffer) => {
                        let data = new Uint8Array(buffer);
                          status = data[0];
                      });

                  }, 5000);

                  break;

                default:
                  status = 1;
                  break

              }


              if(typeof status !== "undefined") {
                resolve(status);
              }

            }


          },

          (error)=> {
            console.log(error);

            reject(error);
          }
        );

      }

    })
  }

  getDataFromConnectedDevices(specificMac = null, specificDeviceType = null): Promise<any> {

    return new Promise((resolve, reject) => {


      if(specificMac === null) {

        if (this.connectedDevices.length > 0) {
          this.connectedDevices.forEach((value, i) => {

            this.ble.isConnected(value.mac).then(
              () => {


                //find device type
                let index2 = this.storageDevices.findIndex(x => x.mac == value.mac);
                let deviceType = this.storageDevices[index2].type;


                console.log('Connected to ' + value.mac);

                this.getStatusesFromCharacteristic(value.mac).then((result) => {
                  let index = this.connectedDevices.findIndex(x => x.mac == value.mac);

                  if(deviceType === 'switch') {
                    this.connectedDevices[index].channel1 = result['channel1'];
                    this.connectedDevices[index].channel2 = result['channel2'];
                  } else if(deviceType === 'shutter') {
                    this.connectedDevices[index].shutter_status = result;
                  }


                });

              },

              () => {
                console.log('Cannot connect to ' + value.mac);
                // jak nie polaczone - usun z listy
                let index = this.connectedDevices.findIndex(x => x.mac == value.mac);
                if (index !== -1) {
                  this.connectedDevices.splice(index, 1);
                }


              });

            setTimeout(() => {
              resolve();
            }, 2000);

          });

        } else {

          console.log('not connected');

          resolve();

        }


      } else {


        this.ble.isConnected(specificMac).then(
          () => {


            console.log('Connected ' + specificMac);

            this.getStatusesFromCharacteristic(specificMac).then((result) => {


              let index2 = this.storageDevices.findIndex(x => x.mac == specificMac);
              let deviceType = this.storageDevices[index2].type;

              let index = this.connectedDevices.findIndex(x => x.mac == specificMac);

              if(index !== -1) {
                // update (after reconnection when rssi was not available)
                if(deviceType === 'switch') {
                  this.connectedDevices[index].channel1 = result['channel1'];
                  this.connectedDevices[index].channel2 = result['channel2'];
                } else if(deviceType === 'shutter') {
                  this.connectedDevices[index].shutter_status = result;
                }
              } else {
                // when connect to new device
                if(deviceType === 'switch') {
                  this.connectedDevices.push({
                    mac: specificMac,
                    channel1: result['channel1'],
                    channel2: result['channel2']
                  });
                } else if(deviceType === 'shutter') {

                  this.connectedDevices.push({
                    mac: specificMac,
                    shutter_status: result
                  });

                }

              }

            });

          },

          () => {
            console.log('Cannot connect ' + specificMac);
            // delete from list
            let index = this.connectedDevices.findIndex(x => x.mac == specificMac);
            if (index !== -1) {
              this.connectedDevices.splice(index, 1);
            }


          });

        setTimeout(() => {
          resolve();
        }, 2000);

      }

      });

  }




  connectToDevices(): Promise<any> {

    return new Promise((resolve, reject) => {

      if(this.devicesFromBLE.length > 0) {

          this.devicesFromBLE.forEach((value, i) => {

          this.connect(value.mac).then(
            () => {
              // add to connected devices
              this.connectedDevices.push(value);

            },
            () => {

              console.log('Cannot connect to device');

            });

        });



        setTimeout(function() {

          resolve();

        }, 3000);

      } else {

        resolve();

      }


      });


  }




  isConnected(mac) {


    this.connect(mac).then(
      () => {
        // add to connected devices
        this.showMessage('Is connected')

      },
      ()=> {
        this.showMessage('Not connected');
      }

      );

  }



  listeningForConnections() {


    setInterval(() => {

      if(this.inRefreshingMode === false) {
      console.log('timer');

      // check if lost connection devices list is not empty

      if(this.disconnectedDevices.length >0) {

        this.disconnectedDevices.forEach((value) => {

          this.connect(value.mac, true).then(
            () => {

              console.log('Connected again');

              this.ngZone.run(() => {
                // add to available list
                let findIndex = this.availableDevices.findIndex(x => x.mac == value.mac);
                if (findIndex === -1) {
                  this.availableDevices.push(value);
                  this.connectedDevices.push(value);
                }
                // get statuses from devices
                this.getStatusesFromCharacteristic(value.mac).then((result) => {
                  let index = this.availableDevices.findIndex(x => x.mac == value.mac);

                  if(this.availableDevices[index].type === 'switch') {
                    this.availableDevices[index].channel1 = result['channel1'];
                    this.availableDevices[index].channel2 = result['channel2'];
                  } else if(this.availableDevices[index].type === 'shutter') {
                    this.availableDevices[index].shutter_status = result;

                  }


                });

                // delete from disconnected list
                let index2 = this.disconnectedDevices.findIndex(x => x.mac == value.mac);
                if (index2 !== -1) {
                  this.disconnectedDevices.splice(index2, 1);
                }

                //delete from not available list
                let index3 = this.notAvailableDevices.findIndex(x => x.mac == value.mac);
                if (index3 !== -1) {
                  this.notAvailableDevices.splice(index3, 1);
                }
              });

              this.showMessage("Ponownie połączono z " + value.mac);

            },

            () => {
              console.log('Nie mozna polaczyc');
            }

            );

        });

      }
     }
    },6000);


  }


  onShutterChange(mac, status) {

    this.ngZone.run(() => {

      this.shuttersWorking[mac] = true;

    });

    //prepere data binary array
    let data = new Uint8Array(1);

    // build value to send
    if(status === 1) {
      data[0] = 1;
    }

    else if(status === 2) {
      data[0] = 2;
    }



    this.ble.isConnected(mac).then(
      () => {
        this.ble.write(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC, data.buffer).then(
          () => {

              setTimeout(()=> {

                this.ngZone.run(() => {
                this.shuttersWorking[mac] = false;
                let index = this.availableDevices.findIndex(x => x.mac == mac);
                if (index !== -1) {
                  if(status === 1) {
                    this.availableDevices[index].shutter_status = 1;
                  } else if (status === 2) {
                    this.availableDevices[index].shutter_status = 2;
                  }
                }

              });

              }, 10000);



          },
            e => this.showMessage('Unexpected Error' + e)
        );
      },
      () => {
        this.ble.connect(mac).subscribe(
          peripheral => {

            this.ble.write(mac, NORDIC_SERVICE, NORDIC_CHARACTERISTIC, data.buffer).then(
              () => {


              },
                e => this.showMessage('Error when changing status')
            );
          },
          peripheral => this.showMessage('Disconnected ' + peripheral)
        );

      }
    );

  }


  disconnect(mac) {

    this.ble.disconnect(mac).then(()=> {
      this.showMessage('Disconnected successfully');
    },

      ()=> {

      this.showMessage('Cannot disconnect with ' + mac);

      }

      );

  }


  connectAgain(mac) {


    this.connect(mac, true).then(
      () => {

        this.ngZone.run(() => {

          // add to available
          let index = this.storageDevices.findIndex(x => x.mac == mac);
          if (index !== -1) {
            this.availableDevices.push(this.storageDevices[index]);
            this.connectedDevices.push(this.storageDevices[index]);
          }
          // get statuses
          this.getStatusesFromCharacteristic(mac).then((result) => {
            let index = this.availableDevices.findIndex(x => x.mac == mac);

            if(this.availableDevices[index].type === 'switch') {
              this.availableDevices[index].channel1 = result['channel1'];
              this.availableDevices[index].channel2 = result['channel2'];
            } else if(this.availableDevices[index].type === 'shutter') {
              this.availableDevices[index].shutter_status = result;

            }


          });

          // delete from disconnected
          let index2 = this.disconnectedDevices.findIndex(x => x.mac == mac);
          if (index2 !== -1) {
            this.disconnectedDevices.splice(index2, 1);
          }

          //delete from  not available list
          let index3 = this.notAvailableDevices.findIndex(x => x.mac == mac);
          if (index3 !== -1) {
            this.notAvailableDevices.splice(index3, 1);
          }
        });

        this.showMessage("Connected with " + mac);

      },

      () => {
        console.log('Cannot connect');
      }

    );


  }



}

import { Component, NgZone } from '@angular/core';
import {IonicPage, NavController, NavParams, Events, LoadingController} from 'ionic-angular';
import { BLE } from '@ionic-native/ble';
import { ToastController } from 'ionic-angular';
import {Storage} from "@ionic/storage";



/**
 * Class AddDevicePage
 *
 * Class is responsible for searching available device, show data from advertising and execute saving device process.
 */


// public name of your devices - app will show only devices with that name
const DEVICES_NAME_BRAND = 'Name';

@IonicPage()
@Component({
  selector: 'page-add-device',
  templateUrl: 'add-device.html',
})


export class AddDevicePage {

  public deviceFromBLE = {};
  public isAny = false;
  public advertising;
  public mac;

  private loader;

  public storageReady = false;

  public countTry = 0;

  public status;

  public type;

  private devicesFromStorage = [];


  constructor(public navCtrl: NavController,
              public navParams: NavParams,
              private toastCtrl: ToastController,
              private ngZone: NgZone,
              private ble: BLE,
              private storage: Storage,
              public events: Events,
              public loadingCtrl: LoadingController,


  ) {


    this.getDevicesFromStorage().then(() => {

      this.ngZone.run(() => {

        this.storageReady = true;

      });

    });

  }


  getDevicesFromStorage(): Promise<any> {


    return new Promise((resolve, reject) => {
      this.devicesFromStorage = [];


      // if storage ready
      this.storage.ready().then(() => {

          // foreach through whole storage
          this.storage.forEach((value) => {

            // add device data from storage to array
            this.devicesFromStorage.push(value.mac);

            this.storage.length().then((data) => {
              if (data == this.devicesFromStorage.length) {
                resolve();
              } else if(data == 0) {
                resolve();
              }
            });

          });

        this.storage.length().then((data) => {
          if (data == 0) {
            resolve();
          }
        });



      });

    });

  }




  /**
   * Scanning for BLE device
   */
  scanForBleDevice(retry = null) {

    this.presentLoading("Searching for devices...", 4000);


    // clear devices list
    this.deviceFromBLE = {};
    this.advertising = '';
    this.mac = '';

    if(retry === null) {
      this.countTry = 0;
    }


    // start scanning
    this.ble.startScanWithOptions([],
      { reportDuplicates: false }).subscribe(
        device => {
          let position = this.devicesFromStorage.indexOf(device.id);

          if (!~position) {
            this.onDeviceDiscovered(device)
          }
        },
        error => this.scanError(error)
      );



  }


  // save device to object
  onDeviceDiscovered(device) {
    console.log('Discovered ' + JSON.stringify(device, null, 2));

    // check if name contain brand name string - show only brand devices
    if (device.name.match(DEVICES_NAME_BRAND)) {

      this.ngZone.run(() => {

        this.getAdvertising(device.advertising).then((decodedAdvertising)=> {

          this.advertising = decodedAdvertising;

          // if advertising shows strange signs (sometimes happened on Android & Samsung phones)
          if (decodedAdvertising.match('default') === null && decodedAdvertising.match('switch') === null && decodedAdvertising.match('shutter') === null) {


            if(this.countTry <= 25) {
              // try again
              this.scanForBleDevice('retry');
              this.countTry++;

            } else {
              // critical error - still strange sings in advertising
              console.log('critical error - still strange sings in advertising');
            }

          } else {


            // check if advertising have different string than 'default'
            if (decodedAdvertising.match('switch') || decodedAdvertising.match('shutter')) {

              // angular have problem with dynamic properties so this is hack
              this.mac = device.id;

              // bind founded device to property
              this.buildDeviceObject('mac', device.id);
              this.buildDeviceObject('name', device.name);
              this.buildDeviceObject('source', 'ble');


              if (this.advertising.match('switch')) {
                this.buildDeviceObject('type', 'switch');
                let deviceStatuses = this.decodeSwitchChannelsStatusesFromCode(this.advertising);
                this.buildDeviceObject('channel1', deviceStatuses[0]);
                this.buildDeviceObject('channel2', deviceStatuses[1]);
                this.buildDeviceObject('channel1name', 'Kanał 1');
                this.buildDeviceObject('channel2name', 'Kanał 2');
                this.type = 'switch';
              } else if(this.advertising.match('shutter')) {
                this.type = 'shutter';
                  this.buildDeviceObject('type', 'shutter');
                let deviceStatus = this.decodeShutterChannelStatusFromCode(this.advertising);
                this.buildDeviceObject('shutter_status', deviceStatus);
              }




              // inform view that some device is found
              this.isAny = true;

            } else {
              this.isAny = false;
            }

          }

        });

      });

   }

  }


  scanError(error) {
    let toast = this.toastCtrl.create({
      message: 'Error scanning for Bluetooth low energy devices',
      position: 'bottom',
      duration: 5000
    });
    toast.present();
  }


  buildDeviceObject(property, value) {
    this.deviceFromBLE[property] = value;
  }


  decodeSwitchChannelsStatusesFromCode(code) {
    let channel1Status = false;
    let channel2Status = false;

    if (code.match('switch_03')) {
      channel1Status = true;
      channel2Status = true;
    }

    else if (code.match('switch_02')) {
      channel1Status = false;
      channel2Status = true;
    }

    else if (code.match('switch_00')) {
      channel1Status = false;
      channel2Status = false;
    }

    else if (code.match('switch_01')) {
      channel1Status = true;
      channel2Status = false;
    }

    return [channel1Status, channel2Status];

  }


  decodeShutterChannelStatusFromCode(code) {

    let status = 0;

    if (code.match('shutter_01')) {
      status = 1;
    }

    else if (code.match('shutter_02')) {
      status = 2;
    }

    else if (code.match('shutter_03')) {
      status = 3;
    }


    return status;

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

  saveDeviceToStorage() {

    this.storage.ready()
      .then(() => this.storage.set(this.mac, this.deviceFromBLE))
      .then(() => {
        this.events.publish('device:action', 'add', this.deviceFromBLE);
        this.navCtrl.pop();
      }
  );

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

}

import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Events } from 'ionic-angular';
import { Storage } from '@ionic/storage';

/**
 * EditDevicePage class
 *
 * Show, edit, save actual device data in storage.
 */

@IonicPage()
@Component({
  selector: 'page-edit-device',
  templateUrl: 'edit-device.html',
})
export class EditDevicePage {

  public mac: string;
  public name: string;
  public channel1name: string;
  public channel2name: string;
  public source = 'ble';
  public type: string;

  constructor(public navCtrl: NavController,
              public navParams: NavParams,
              public storage: Storage,
              public events: Events


  ) {
    let deviceMac = navParams.get('mac');
    this.getDeviceData(deviceMac);
  }



  getDeviceData(key) {
    this.storage.get(key).then((data)=>{
      this.mac = data.mac;
      this.name = data.name;
      this.source = 'ble';
      this.channel1name = data.channel1name;
      this.channel2name = data.channel2name;
      this.type = data.type;
    });

  }


  updateDeviceData() {
    let data = {
    "mac" : this.mac,
    "name" : this.name,
    "source" : this.source,
    "channel1name" : this.channel1name,
    "channel2name" : this.channel2name,
    "type" : this.type
    };

    this.storage.set(this.mac, data).then(() => {
      this.events.publish('device:action', 'update', data);
      this.navCtrl.pop();
    });

  }


  deleteDevice(key) {
    let data = {
      "mac" : this.mac,
      "name" : this.name,
      "source" : this.source,
      "channel1name" : this.channel1name,
      "channel2name" : this.channel2name,
      "type" : this.type
    };

    this.storage.remove(key).then(()=> {
      this.events.publish('device:action', 'delete', data);
      this.navCtrl.pop();
    });

  }


}

# Angular 2 (Ionic) application working with multiple BLE peripherials 
> !! This app is written to work with specific devices configuration (see bellow). 
It will not work with any BLE devices until it is adapted to your needs !! This app is my training camp while preparing to work on the final IoT project. So treat it as showcase app.

## Table of contents
* [Features](#Features)
* [Customize](#Customize)
* [Status](#Status)
* [Contact](#contact)

## Features
* Home page shows devices list (available and not available). Previously paired
devices are saves in phone storage. when the application is launched it scan for available devices and compare with storage data. In result it shows available and not available devices on list.
* Add new device (scan and pair)
* Toggle action (this app is designed to work with 2 devices type: switch (on/off), shutter(up/down))
* Read actual statuses from devices via advertising
* Scanning shows only devices with specific name (for ex. brand name) and don't show any others.
* Anonymous programming Java Script


## Customize

1. Set BLE UUID's

File: /src/pages/home/home.ts

`const NORDIC_SERVICEl` // device service ID

`const NORDIC_CHARACTERISTIC` // device characteristic ID


2. Set device name (public name of your devices - app will show only devices with that name)

File: /src/pages/add-device/add-device.ts

```sh
      const DEVICES_NAME_BRAND = 'Name';
```
3. Customize algorithm for devices type, statuses, codes etc.

Files: /src/pages/add-device/add-device.ts , /src/pages/home/home.ts, /src/pages/edit-device/edit-device.ts

Change methods like:

```sh
   buildDevicesListToWork()
   decodeSwitchChannelsStatusesFromCode()
   getStatusesFromCharacteristic()
   etc ...
```


## Status
This app is my training camp while preparing to work on the final IoT project. So treat it as showcase app.
It will not be developed in the future.


## Contact
Created by [@sebastianSkurnog](http://www.skurnog.com/) - feel free to contact me!

let CONFIG = {
  filter_devices: true,
  debug: false,

  allowed_devices: {},
 
  kvs_key: "allowed_devices",
  mqtt_topic: "blegateway/",
  discovery_topic: "homeassistant/",

};

//BTHomev2: ID , Size, Sign, Factor, Name
let datatypes = [
  [0x00, 1, false, 1,    'pid'],
  [0x01, 1, false, 1,    'battery'],
  [0x12, 2, false, 1,    'co2'],
  [0x0c, 2, false, 0.001,'voltage'],
  [0x4a, 2, false, 0.1,  'voltage'],
  [0x08, 2, true,  0.01, 'dewpoint'],
  [0x03, 2, false, 0.01, 'humidity'],
  [0x2e, 1, false, 1,    'humidity'],
  [0x05, 3, false, 0.01, 'illuminance'],
  [0x14, 2, false, 0.01, 'moisture'],
  [0x2f, 1, false, 1,    'moisture'],
  [0x04, 3, false, 0.01, 'pressure'],
  [0x45, 2, true,  0.1,  'temperature'],
  [0x02, 2, true,  0.01, 'temperature'],
  [0x3f, 2, true,  0.1,  'rotation'],
  [0x3a, 1, false, 1,    'button'], //selector
  [0x15, 1, false, 1,    'battery_ok'], //binary
  [0x16, 1, false, 1,    'battery_charging'], //binary
  [0x17, 1, false, 1,    'co'], //binary
  [0x18, 1, false, 1,    'cold'], //binary
  [0x1a, 1, false, 1,    'door'], //binary
  [0x1b, 1, false, 1,    'garage_door'], //binary
  [0x1c, 1, false, 1,    'gas'], //binary
  [0x1d, 1, false, 1,    'heat'], //binary
  [0x1e, 1, false, 1,    'light'], //binary
  [0x1f, 1, false, 1,    'lock'], //binary
  [0x20, 1, false, 1,    'moisture_warn'], //binary
  [0x21, 1, false, 1,    'motion'], //binary
  [0x2d, 1, false, 1,    'window'], //binary
];

let discovered = [];

//format is subset of https://docs.python.org/3/library/struct.html
let packedStruct = {
  buffer: '',
  setBuffer: function(buffer) {
    this.buffer = buffer;
  },
  utoi: function(u16) {
    return (u16 & 0x8000) ? u16 - 0x10000 : u16;
  },
  getUInt8: function() {
    return this.buffer.at(0)
  },
  getInt8: function() {
    let int = this.getUInt8();
    if(int & 0x80) int = int - 0x100;
    return int;
  },
  getUInt16LE: function() {
    return 0xffff & (this.buffer.at(1) << 8 | this.buffer.at(0));
  },
  getInt16LE: function() {
    return this.utoi(this.getUInt16LE());
  },
  getUInt16BE: function() {
    return 0xffff & (this.buffer.at(0) << 8 | this.buffer.at(1));
  },
  getInt16BE: function() {
    return this.utoi(this.getUInt16BE(this.buffer));
  },
  getUInt24LE: function() {
    return 0xffffff & (this.buffer.at(2) << 16 | this.buffer.at(1) << 8 | this.buffer.at(0));
  },
  getInt24LE: function() {
    return this.utoi(this.getUInt24LE());
  },
  getUInt24BE: function() {
    return 0xffffff & (this.buffer.at(0) << 16 | this.buffer.at(1) << 8 | this.buffer.at(2));
  },
  getInt24BE: function() {
    return this.utoi(this.getUInt24BE(this.buffer));
  },
  unpack: function(fmt, keyArr) {
    let b = '<>!';
    let le = fmt[0] === '<';
    if(b.indexOf(fmt[0]) >= 0) {
      fmt = fmt.slice(1);
    }
    let pos = 0;
    let jmp;
    let bufFn;
    let res = {};
    while(pos<fmt.length && pos<keyArr.length && this.buffer.length > 0) {
      jmp = 0;
      bufFn = null;
      if(fmt[pos] === 'b' || fmt[pos] === 'B') jmp = 1;
      if(fmt[pos] === 'h' || fmt[pos] === 'H') jmp = 2;
      if(fmt[pos] === 'i' || fmt[pos] === 'I') jmp = 3;
      if(fmt[pos] === '4') jmp = 4; //just skip for now
      if(fmt[pos] === '6') jmp = 6; //just skip for now

      if(fmt[pos] === 'b') {
        res[keyArr[pos]] = this.getInt8();
      }
      else if(fmt[pos] === 'B') {
        res[keyArr[pos]] = this.getUInt8();
      }
      else if(fmt[pos] === 'h') {
        res[keyArr[pos]] = le ? this.getInt16LE() : this.getInt16BE();
      }
      else if(fmt[pos] === 'H') {
        res[keyArr[pos]] = le ? this.getUInt16LE() : this.getUInt16BE();
      }
      else if(fmt[pos] === 'i') {
        res[keyArr[pos]] = le ? this.getInt24LE() : this.getInt24BE();
      }
      else if(fmt[pos] === 'I') {
        res[keyArr[pos]] = le ? this.getUInt24LE() : this.getUInt24BE();
      }
      this.buffer = this.buffer.slice(jmp);
      pos++;
    }
    return res;
  }
};

function convertByteArrayToSignedInt(bytes, byteSize) {
  let result = 0;
  const signBit = 1 << (byteSize * 8 - 1);
  for (let i = 0; i < byteSize; i++) {
    result |= (bytes.at(i) << (i * 8));
  }
  // Check sign bit and sign-extend if needed
  if ((result & signBit) !== 0) {
    result = result - (1 << (byteSize * 8));
  }
  return result;
};

function convertByteArrayToUnsignedInt(bytes, byteSize) {
  let result = 0;
  for (let i = 0; i < byteSize; i++) {
    result |= (bytes.at(i) << (i * 8));
  }
  return result >>> 0; // Ensure the result is an unsigned integer
};

function extractBTHomeData(payload) {
  let index = 0;
  let extractedData = {};
  var button_ordinal = 0;
  while (index < payload.length) {
    dataId = payload.at(index);
    index = index + 1;
    let dataType = -1;
    for (let i = 0; i < datatypes.length; i++) {
      if (datatypes[i][0] == dataId) {
        dataType = i;
        break;
      }
    }
    if (dataType > -1) {
      let byteSize = datatypes[dataType][1];
      let factor = datatypes[dataType][3];
      let rawdata = payload.slice(index, index + byteSize);
      if (datatypes[dataType][2]) {
        value = convertByteArrayToSignedInt(rawdata, byteSize);
      } else {
        value = convertByteArrayToUnsignedInt(rawdata, byteSize);
      }

      // buttons data, expected in fixed order one after another
      if (datatypes[dataType][0] == 0x3a) {

        if (!extractedData[datatypes[dataType][4]]) {
          extractedData[datatypes[dataType][4]] = [];
        }

        extractedData[datatypes[dataType][4]][button_ordinal] = convertIntToButtonEvent(value * factor);
        button_ordinal++;
      } else {
        extractedData[datatypes[dataType][4]] = value * factor;
      }

      index += byteSize;
    } else { index = 10; }
  }

  return extractedData;
};

/**
 * Converts integer value of button event to textual representation
 * @param {number} intval
 * @returns {string}
 */
function convertIntToButtonEvent(intval) {
  switch (intval) {
    case 0x00:
      return 'none';
    case 0x01:
      return 'press';
    case 0x02:
      return 'double_press';
    case 0x03:
      return 'triple_press';
    case 0x04:
      return 'long_press';
    case 0x80:
      return 'hold';
    case 0xFE:
      return 'hold';
    default:
      return 'unsupported: ' + intval;
  }
}

/**
 * Determine topic name for data.\
 * Depending on number of keys in provided struct, it returns:
 * * name of key, if struct contains only one key provided struct contains only one key
 * * `data` string if there are more keys.
 * * empty string if no keys found
 * @param {<Object>} resarray Array of data
 * @returns {string} name of an MQTT topic to store data to
 */
function getTopicName(resarray) {
  let rlen = Object.keys(resarray).length;
  if (rlen == 0) return "";
  if (rlen == 1) return Object.keys(resarray)[0];
  return "data";
}

/**
 * Function creates and returns a device data in format requierd by MQTT discovery.
 *
 * Manufacturer and model are retrieved from CONFIG.allowedMACs global variable.
 * Device name is built from its mac address and model name (if exists)
 * via_device is set to Shelly address the script is run on.
 *
 * @param address {string} - normalized already mac address of the BLE device.
 * @returns {Object} device object structured for MQTT discovery
 */
function discoveryDevice(address) {

  let model = "";

  if (CONFIG.allowed_devices[address][1] !== undefined) {
    model = CONFIG.allowed_devices[address][1];
  }

  let device = {};
  device["name"] = address + (model === "" ? "" : "-" + model);
  device["ids"] = [address + ""];
  device["cns"] = [["mac", address]];
  device["via_device"] = normalizeMacAddress(Shelly.getDeviceInfo().mac);

  if (CONFIG.allowed_devices[address][0] !== undefined) {
    device["mf"] = CONFIG.allowed_devices[address][0];
  }

  if (model !== "") {
    device["mdl"] = model;
  }

  console.log("Device name: ", device["name"]);

  return device;
}




/**
 * Cretes and publishes discovery topic for single entity
 * @param {string} objident Object identifier used for preventing repeating discovery topic creation. Will be returned back in the result struct
 * @param {string} topic MQTT topic where data are reported to. Needed to include into Discovery definition
 * @param {string} objtype Name of object type. Mostly it will be borrowed for entity name
 * @param {number} bt_index 0-based index of button. Used to identify a button being a member of a multi-button device
 * @return {Object} Object with data for publishing to MQTT
 */
function discoveryEntity(objident, topic, objtype, bt_index) {

  let pload = {};

  // Some defaults. Might be overriden later
  pload["name"]     = objtype;
  pload["uniq_id"]  = objident;
  pload["stat_t"]   = topic;
  pload["val_tpl"]  = "{{ value_json." + objtype + " }}";
  pload["stat_cla"]     = "measurement"

  let subt = "";
  let domain;

  switch (objtype) {

    /* SENSORS */

    case "temperature":
    case "humidity":
      domain = "sensor";
      pload["dev_cla"]      = objtype;
      pload["unit_of_meas"] = objtype === "temperature" ? "°C" : "%";
      subt = objtype;
      break;

    case "battery":
      domain = "sensor";
      pload["dev_cla"]      = "battery";
      pload["ent_cat"]      = "diagnostic";
      pload["unit_of_meas"] = "%";
      subt                  = "battery";
      break;

    case "illuminance":
      domain = "sensor";
      pload["dev_cla"]      = "illuminance";
      pload["unit_of_meas"] = "lx";
      subt                  = pload["dev_cla"];
      break;

    case "pressure":
      domain                = "sensor";
      pload["dev_cla"]      = "atmospheric_pressure";
      pload["unit_of_meas"] = "hPa";
      subt                  = pload["dev_cla"];
      break;

    case "rssi":
      domain                = "sensor";
      pload["dev_cla"]      = "signal_strength";
      pload["ent_cat"]      = "diagnostic";
      pload["unit_of_meas"] = "dBm";
      subt                  = "rssi";
      break;

    case "rotation":
      domain                = "sensor";
      pload["name"]         = "tilt";
      pload["unit_of_meas"] = "°";
      pload["stat_t"] = topic + "/rotation";
      subt                  = pload["name"];
      delete pload.val_tpl;
      break;

    /* BINARY SENSORS */

    case "window":
      domain                = "binary_sensor";
      pload["name"]         = "contact";
      pload["dev_cla"]      = "opening";
      pload["pl_on"]        = 1;
      pload["pl_off"]       = 0;
      pload["stat_t"]       = topic + "/window";
      subt                  = pload["dev_cla"];
      delete pload.val_tpl;
      break;

    case "motion":
      domain                = "binary_sensor";
      pload["dev_cla"]      = "motion";
      pload["pl_on"]        = 1;
      pload["pl_off"]       = 0;
      subt                  = pload["dev_cla"];
      break;

    /* BUTTONS */

    case "button":

      domain = "event";
      pload["p"]     = "event";
      pload["dev_cla"] = "button";
      pload["evt_typ"]  = ["none", "press", "double_press", "triple_press", "long_press", "hold"];

      if (bt_index == -1) {
        pload["name"]       = pload["dev_cla"]
        subt                = pload["dev_cla"];
      } else {
        pload["name"]       = "button " + (bt_index + 1);
        subt                = "button-" + (bt_index + 1);
      }

      if (bt_index == -1) bt_index = 0;

      pload["stat_t"]       = topic;
      pload["val_tpl"]      = '{% set buttons = value_json.get("button") %} \
{ {%- if buttons and buttons[' + bt_index + '] != "none" -%} \
"button": "button", "event_type": "{{ buttons[' + bt_index + '] }}" \
{%- endif -%} }';

      break;
    default:
    //  printDebug("Unrecognized obj type: ", objtype, ". Ignored");
      return;
      break;
  }

  return { "objident": objident, "domain": domain, "subtopic": subt, "data": pload }
}


/**
 * Normalize MAC address removing : and - characters, and making the rest lowercase
 * @param {string} address MAC address
 * @returns {string} normalized MAC address
 */
function normalizeMacAddress(address) {
  return String(address).split("-").join("").split(":").join("").toLowerCase();
}

/**
 * Determines whethere device identified by the `address` has to be processed or skipped.
 * @param {string} address Normalized form of MAC address
 * @returns {boolean} False if device has to be skipped. Otherwise true.
 */
function allowDevices(address) {
  if (!CONFIG.filter_devices) return true;

  // escape if not mac address found
  if (CONFIG.allowed_devices[address] === undefined) {
      return false;
  }

  return true;
}

/**
 * Generate discovery topics when not yet reported
 * @param {string} address
 * @param {string} topic
 * @param {<Object>} jsonstr
 */
function discoveryItems(address, topic, jsonstr) {

  let params = Object.keys(jsonstr);
  let ploads = [];

  // Iterate through all values, even unsupported.
  // Not supported params will be ignored within autodiscovery()
  // then stored into `discovered` array and never processed again.
  for (let i = 0; i < params.length; i++) {
    let objtype = params[i];
    if (objtype == 'button' && jsonstr['button'].length > 1) { // pass only multiple buttons
      for (let b = 0; b < jsonstr['button'].length; b++) {
        let objident = address + "-" + objtype + "-" + (b + 1);
        if (discovered.indexOf(objident) == -1) {
       //   ploads.push(discoveryEntity(objident, topic, objtype, b));
        }
      }
    }
    else {
      let objident = address + "-" + objtype;
      if (discovered.indexOf(objident) == -1) {
   //     ploads.push(discoveryEntity(objident, topic, objtype, -1)); // we need that -1 in case of single button device (simplifies its name)
      }
    }
  }

  for (let i = 0; i < ploads.length; i++) {

    if (ploads[i] === undefined) continue;

    ploads[i].data.device = discoveryDevice(address);
    let discoveryTopic = CONFIG.discovery_topic + ploads[i].domain + "/" + address + "/" + ploads[i].subtopic + "/config";

    MQTT.publish(discoveryTopic, JSON.stringify(ploads[i].data), 1, true);
    console.log("Discovered: ", ploads[i].data.name, "; path", discoveryTopic);

    discovered.push(ploads[i].objident); //mark as discovered
  }
}

function mqttreport(address, rssi, jsonstr) {

 // console.log("discovered size:" + discovered.length);
  let macNormalized = normalizeMacAddress(address);

  if (!allowDevices(macNormalized)) {
    printDebug("Ignored MAC: ", macNormalized);
    return;
  }

  //console.log("Processed MAC: ", macNormalized);
  //printDebug("Data: ", JSON.stringify(jsonstr));

  let topic = CONFIG.mqtt_topic + macNormalized + "/" + getTopicName(jsonstr);
  //printDebug("Topic:", topic);

  jsonstr['rssi'] = rssi;
  if (true) {
    jsonstr['src'] = Shelly.getDeviceInfo().id + " (" + Shelly.getDeviceInfo().name + ")";
  }

  // Create discovery entries if needed
  discoveryItems(macNormalized, topic, jsonstr);

  MQTT.publish(topic, JSON.stringify(jsonstr), 1, false);

  // Need to store those parameters into separate topics, since they are not reported with every message.
  // It renders in unavailable state on HA restart
  if (jsonstr.hasOwnProperty('window')) {
    MQTT.publish(topic + '/window', JSON.stringify(jsonstr.window), 1, true);
  }

  if (jsonstr.hasOwnProperty('rotation')) {
    MQTT.publish(topic + '/rotation', JSON.stringify(jsonstr.rotation), 1, true);
  }

}

function scanCB(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT) return;
   if (res.advData.length < 10) return;
   let prot = "";
   let sc = 0;
   while (sc < 10) { //strip unneeded data
     sc = sc + 1;
     if (res.advData.at(0) > 9) {
       sc = 10;
     } else {
       if (res.advData.length > res.advData.at(0)) {
         res.advData = res.advData.slice( res.advData.at(0)+1 );
       }
     }
   }
   if (res.advData.length < 10) return;
   let hdr = {};
//   console.log(res.addr,res.rssi,res.advData.length,res.advData.at(0), res.advData.at(1) ,res.advData.at(2), res.advData.at(3),res.advData.at(6), res.advData.at(7),res.advData.at(15), res.advData.at(16));
   if (res.advData.at(1) == 0x16) {
    packedStruct.setBuffer(res.advData);
    if ((res.advData.at(2) == 0x1a) && (res.advData.at(3) == 0x18)) { //atc
      if (res.advData.length==17) { //atc1441
       hdr = packedStruct.unpack('>46hBBHB', ['id','mac','temperature','humidity','battery','battery_mv','frame']);
       hdr.temperature = hdr.temperature / 10.0;
       prot =  "atc1441";
      } else if (res.advData.length==19) { //atc custom
       hdr = packedStruct.unpack('<46hHHBBB', ['id','mac','temperature','humidity','battery_mv','battery','frame']);
       hdr.temperature = hdr.temperature * 0.01;
       hdr.humidity = hdr.humidity * 0.01;
       prot = "atc_custom";
      }
    } //end atc
    else if ((res.advData.at(2) == 0x95) && (res.advData.at(3) == 0xfe)) { //xiaomi
      if (res.advData.length < 18) return;
      prot = "xiaomi";
      let ofs = 0;
      if ( (res.advData.at(16) != 0x10) && (res.advData.at(17) == 0x10) ) {
         ofs = 1;
      }
      if ( (res.advData.at(6) == 0x76) && (res.advData.at(7) == 0x05) ) {
        packedStruct.setBuffer(res.advData.slice(17));
        hdr = packedStruct.unpack('<hH', ['temperature','humidity']);
        hdr.temperature = hdr.temperature / 10.0;
        hdr.humidity = hdr.humidity / 10.0;

      } else {
        let dataType = res.advData.at(15 + ofs);
        let dataSize = res.advData.at(17 + ofs);

        if ( (dataType == 4) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<h', ['temperature']);
          hdr.temperature = hdr.temperature / 10.0;

        } else if ( (dataType == 6) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<H', ['humidity']);
          hdr.humidity = hdr.humidity / 10.0;

        } else if ( (dataType == 7) && (dataSize >= 3) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<I', ['illuminance']);

        } else if ( (dataType == 8) && (dataSize == 1) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<B', ['moisture']);

        } else if ( (dataType == 9) && (dataSize > 0) ) {
          packedStruct.setBuffer(res.advData.slice(18+ofs));
          hdr = packedStruct.unpack('<H', ['soil']);

        } else if ( (dataType == 0xA) && (dataSize > 0) ) {
          hdr = { battery: res.advData.at(18+ofs)};

        } else if ( (dataType == 0xD) && (dataSize > 3) ) {
            packedStruct.setBuffer(res.advData.slice(18+ofs));
            hdr = packedStruct.unpack('<hH', ['temperature','humidity']);
            hdr.temperature = hdr.temperature / 10.0;
            hdr.humidity = hdr.humidity / 10.0;
        }
      }
    } // end xiaomi
    else if ((res.advData.at(2) == 0xd2) && (res.advData.at(3) == 0xfc)) { //bthomev2
         if ( (res.advData.at(4) & 0x1) != 1 ) { // no encryption
            prot = 'bthome2';
            hdr = extractBTHomeData(res.advData.slice(5))
         }
    } // end bthomev2
   } //0x16
if (prot != "") { mqttreport(res.addr, res.rssi, hdr); }; // console.log(prot, res.addr, res.rssi, hdr);
}

function init() {
  // get the config of ble component
//  const BLEConfig = Shelly.getComponentConfig("ble");

  // exit if the BLE isn't enabled
  if (!Shelly.getComponentConfig("ble").enable) {
    console.log(
      "Error: The Bluetooth is not enabled, please enable it from settings"
    );
    return;
  }

  // check if the scanner is already running
  if (BLE.Scanner.isRunning()) {
    console.log("Info: The BLE gateway is running, the BLE scan configuration is managed by the device");
  }
  else {
    // start the scanner
    if (!BLE.Scanner.Start({ duration_ms: BLE.Scanner.INFINITE_SCAN, active: false })) {
      console.log("Error: Can not start new scanner");
    }
  }

  // subscribe a callback to BLE scanner
  BLE.Scanner.Subscribe(scanCB);
}

init();

/**
 * Outputs passed arguments to console, only if `CONFIG.debug` is true
 */
function printDebug() {
  if (!CONFIG.debug) return;

  let str = "";
  for (let i = 0; i < arguments.length; i++) {
    str = str + arguments[i];
  }

  console.log(str);
}


/**
 * Get value from KVS
 *
 * @param {string} key Name of the key
 * @param {function} callback Callback function
 * @async
 */
function kvsGet(key, callback) {
  Shelly.call(
    "KVS.Get",
    { key: key },
    function (result, error) {
      if (error == -105) {
        printDebug("No `" + key + "` key found in KVS. It's OK if you don't need that");
      } else if (error) {
        print("KVS Get Error:", JSON.stringify(error));
        callback(null);
      } else {
        callback(result.value);
      }
    }
  );
}



/**
 * Loads data of devices to be processed from KVS to `CONFIG.allowed_devices`.\
 * @param {function} callback
 * @async
 */
function loadBleMacsFromKVS(callback) {
  kvsGet(CONFIG.kvs_key, function (value) {
    if (value !== null) {
      let macs = JSON.parse(value);

      for (let k in macs) {
        CONFIG.allowed_devices[normalizeMacAddress(k)] = macs[k];
      }
    }
    callback();
  });
}


loadBleMacsFromKVS(function () {
  if (Object.keys(CONFIG.allowed_devices).length == 0 && CONFIG.filter_devices) {
    // printDebug("No devices will be processed beucase filter_devices is true and allowed_devices are not set");
  }

  if (Object.keys(CONFIG.allowed_devices).length > 0 && CONFIG.debug) {
    let msg = "Devices configured for processing:\n";
    for (let k in CONFIG.allowed_devices) {
      msg = msg + "\n" + "MAC: " + k
        + "; Manufacturer: " + (CONFIG.allowed_devices[k][0] === undefined ? "<none>" : CONFIG.allowed_devices[k][0])
        + "; Model: " + (CONFIG.allowed_devices[k][1] === undefined ? "<none>" : CONFIG.allowed_devices[k][1]);
    }

    // printDebug(msg);
  }
});
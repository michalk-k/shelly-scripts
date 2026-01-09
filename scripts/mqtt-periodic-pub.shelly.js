/**
* The script publishes periodically selected component statuses to MQTT.
* For valid names of components look into `http://shelly_address/rpc/Shelly.GetStatus` page
* or into status MQTT topic of particular device.
* Note, not all components are reported by default by Shelly device. For example `wifi` is not.
*
* Component name or exact component instance identifier can used in configuration, for example:
* "switch" for refreshing all switches, or
* "switch:0" for refreshing selected one
*
* Note switch component consist of temperature measurement. To make this temperature be refreshed more often, switch component must be published
**/

let CONFIG = {
  components: ["temperature"],  // list of components to report.
                                // Use component name (ie "switch") to refresh all switches
                                // or instance identifier (ie switch:0)

  refresh_period: 60,           // (seconds) how often report components above to mqtt
  publish_delay:  500           // (miliseconds) how often report components above to mqtt
};
let comp_ix = 0; // index of component from CONFIG.components being processed
let inst_id; // ie switch:1 -> inst_id = 1 
let internal_timer;

function publishToMQTT_worker() {

  const comp = CONFIG.components[comp_ix];

  if (!comp) {
    Timer.clear(internal_timer);
    internal_timer = null;
    return;
  }

  let status = Shelly.getComponentStatus(comp);

  if (status) comp_ix++;
  else if (comp.indexOf(":") == -1) {
    // script component instance ids start from 1, other components from 0
    if (inst_id === null) inst_id = (comp == 'script') ? 1 : 0;

    status = Shelly.getComponentStatus(comp, inst_id);
    if (status) inst_id++;
    else {
      comp_ix++;
      inst_id = null;
    }
  }

  if (status) {
    MQTT.publish(Shelly.getComponentConfig("mqtt").topic_prefix + "/status/" + comp + (status.id !== undefined ? ":" + status.id : ""), JSON.stringify(status), 1, false);
  }
}


function publishToMQTT() {
  if (!MQTT.isConnected()) {
    print ("MQTT not connected, skipping publish");
    return;
  }

  comp_ix = 0;
  inst_id = null;
  publishToMQTT_worker();
  internal_timer = Timer.set(CONFIG.publish_delay, true, publishToMQTT_worker, null);
}

// Publish components data immediately, then periodically
publishToMQTT();
let timer_handle = Timer.set(CONFIG.refresh_period * 1000, true, publishToMQTT, null);

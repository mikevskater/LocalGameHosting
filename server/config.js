const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config.json');
const DEFAULT_CONFIG_PATH = path.join(__dirname, '../config.default.json');

class ConfigManager {
  constructor() {
    this.config = null;
    this.load();
  }

  load() {
    try {
      // Try to load config.json
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        // Create config.json from default
        const defaultData = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
        fs.writeFileSync(CONFIG_PATH, defaultData, 'utf8');
        this.config = JSON.parse(defaultData);
        console.log('Created config.json from default. Please update admin credentials!');
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      process.exit(1);
    }
  }

  save() {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      value = value[k];
      if (value === undefined) return null;
    }
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    return this.save();
  }

  getAll() {
    // Return deep copy to prevent accidental mutation
    return JSON.parse(JSON.stringify(this.config));
  }

  update(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.save();
  }
}

module.exports = new ConfigManager();

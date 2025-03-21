const path = require('path');
const fs = require('fs');
const _ = require("underscore");
const express = require('express');
const app = express();
// const objectql = require('@steedos/objectql')
// const util = require('../util/index')
// const ConfigName = 'plugin.config.yml'
import { getSteedosSchema } from '@steedos/objectql';
import * as initConfig from './init-config.json'
const PACKAGE_SERVICE_FILE_NAME = 'package.service.js';
const Future = require('fibers/future');
export class Plugins {
    static async init(coreInitConfig: any = {}) {
        let builtInPluginsName = coreInitConfig.built_in_plugins || [];
        let configedPluginsName = coreInitConfig.plugins || [];
        let pluginsName = _.union(builtInPluginsName, configedPluginsName);

        const pluginContext = {
            app,
            settings: Meteor.settings
        };
        let steedosSchema = getSteedosSchema();
        let broker = steedosSchema.broker;
        if (broker) {
            for (const name of pluginsName) {
                const pluginDir = this.getPluginDir(name);
                let packageServiceFilePath = path.join(pluginDir, PACKAGE_SERVICE_FILE_NAME);
                if (fs.existsSync(packageServiceFilePath)) {
                    await Future.task(async () => {
                        try {
                            let service = broker.loadService(packageServiceFilePath);
                            if(!broker.started){
                                broker._restartService(service)
                            }
                            await broker.waitForServices(service.name)
                            if (_.isFunction(service.init)) {
                                service.init(pluginContext);
                                WebApp.connectHandlers.use(pluginContext.app);
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    }).promise();

                } else {
                    console.error(`Please add ${PACKAGE_SERVICE_FILE_NAME} in Plugin ${name}.`);
                }
            }
        }

        // const pluginContext = {
        //     app,
        //     settings: Meteor.settings
        // };
        // let plugins = this.getPluginNames();
        // if (_.isArray(plugins)) {
        //     for (const pluginName of plugins) {
        //         try {
        //             const pluginDir = this.getPluginDir(pluginName)
        //             const plugin = require(pluginDir);
        //             await this.loadFiles(pluginName);
        //             if(_.isFunction(plugin.init)){
        //                 plugin.init(pluginContext);
        //             }

        //         } catch (error) {
        //             if(true){
        //                 console.error(error)
        //             }else{
        //                 if(error.message.startsWith("Cannot find module")){
        //                     throw new Error(`Plugin not found in project, please execute: yarn add ${pluginName}`)
        //                 }else{
        //                     throw error;
        //                 }
        //             }

        //         }
        //     }
        //     WebApp.connectHandlers.use(pluginContext.app);
        // }
    }

    static getPluginNames() {
        const builtInPlugins = initConfig.built_in_plugins || [];
        const settingsPlugins = Meteor.settings.plugins || [];
        let plugins = _.union(builtInPlugins, settingsPlugins);
        return plugins || [];
    }

    static getPluginDir(pluginName) {
        return path.dirname(require.resolve(`${pluginName}/package.json`, {
            paths: [path.join(require('app-root-path').path, '.plugins'), path.join(process.cwd(), '.plugins')]
        }));
    }

    // static getConfig(pluginDir: string) {
    //     let config: any;
    //     let configPath = path.join(pluginDir, ConfigName)
    //     if (fs.existsSync(configPath) && !fs.statSync(configPath).isDirectory()) {
    //         config = util.loadYmlFile(configPath)
    //     }
    //     return config;
    // }

    // static async loadFiles(pluginName) {
    //     let pluginDir = this.getPluginDir(pluginName);
    //     let config = this.getConfig(pluginDir);
    //     if (config) {
    //         const datasources = _.keys(config.datasources);
    //         for (const name of datasources) {
    //             const _datasource = config.datasources[name];
    //             if (!_.isArray(_datasource.objectFiles)) {
    //                 throw new Error(`${name}.objectFiles must be an array` + _datasource.objectFiles)
    //             }
    //             for (const objectFile of _datasource.objectFiles) {
    //                 let filePath = path.join(pluginDir, objectFile)
    //                 await objectql.addAllConfigFiles(filePath, name)
    //             }
    //         }
    //     }
    // }
}
import { SteedosObjectType } from '../types/object';
import { getDataSource } from '../types/datasource';
import { getObjectConfig } from '../types/object_dynamic_load';
import _ = require('underscore');
import { generateActionRestProp, generateActionGraphqlProp, generateSettingsGraphql, RELATED_PREFIX, _getRelatedType, correctName, getGraphqlActions, getRelatedResolver, dealWithRelatedFields } from './helpers';
import { getObjectServiceName } from '.';
import { jsonToObject } from '../metadata-register/object';
import { extend } from '../util';
const Future = require('fibers/future');
// import { parse } from '@steedos/formula';
// mongodb pipeline: https://docs.mongodb.com/manual/core/aggregation-pipeline/
declare var Creator: any;

type externalPipelineItem = {
    [mongodPipeline: string]: any
}
function getObjectServiceMethodsSchema() {
    const methods = {
        aggregate: {
            async handler(query, externalPipeline: Array<externalPipelineItem>, userSession) {
                return await this.object.aggregate(query, externalPipeline, userSession)
            }
        },
        find: {
            async handler(query, userSession) {
                if (this.object.name == 'users') {
                    return await this.object.find(query)
                }
                return await this.object.find(query, userSession)
            }
        },
        findOne: {
            async handler(id: string, query, userSession) {
                if (this.object.name == 'users') {
                    return await this.object.findOne(id, query)
                }
                return await this.object.findOne(id, query, userSession)
            }
        },
        insert: {
            async handler(doc, userSession) {
                return await this.object.insert(doc, userSession)
            }
        },
        update: {
            async handler(id, doc, userSession) {
                return await this.object.update(id, doc, userSession)
            }
        },
        updateOne: {
            async handler(id, doc, userSession) {
                return await this.object.updateOne(id, doc, userSession)
            }
        },
        updateMany: {
            async handler(queryFilters, doc, userSession) {
                return await this.object.updateMany(queryFilters, doc, userSession)
            }
        },
        delete: {
            async handler(id, userSession) {
                return await this.object.delete(id, userSession)
            }
        },
        directAggregate: {
            async handler(query, externalPipeline: Array<externalPipelineItem>, userSession) {
                return await this.object.directAggregate(query, externalPipeline, userSession)
            }
        },
        directAggregatePrefixalPipeline: {
            async handler(query, externalPipeline: Array<externalPipelineItem>, userSession) {
                return await this.object.directAggregatePrefixalPipeline(query, externalPipeline, userSession)
            }
        },
        directFind: {
            async handler(query, userSession) {
                return await this.object.directFind(query, userSession)
            }
        },
        directInsert: {
            async handler(doc, userSession) {
                return await this.object.directInsert(doc, userSession)
            }
        },
        directUpdate: {
            async handler(id, doc, userSession) {
                return await this.object.directUpdate(id, doc, userSession)
            }
        },
        directDelete: {
            async handler(id, userSession) {
                return await this.object.directDelete(id, userSession)
            }
        },
        count: {
            async handler(query, userSession) {
                return await this.object.count(query, userSession)
            }
        },
        getField: {
            handler(fieldName) {
                return this.object.getField(fieldName).toConfig()
            }
        },
        getFields: {
            handler() {
                return this.object.toConfig().fields;
            }
        },
        getNameFieldKey: {
            handler() {
                return this.object.getNameFieldKey();
            }
        },
        toConfig: {
            handler() {
                return this.object.toConfig()
            }
        },
        getUserObjectPermission: {
            handler(userSession) {
                return this.object.getUserObjectPermission(userSession)
            }
        },
        isEnableAudit: {
            handler() {
                return this.object.isEnableAudit()
            }
        },
        _makeNewID: {
            async handler() {
                return await this.object._makeNewID();
            }
        },
        getRecordAbsoluteUrl: {
            async handler() {
                return this.object.getRecordAbsoluteUrl();
            }
        },
        getGridAbsoluteUrl: {
            async handler() {
                return this.object.getGridAbsoluteUrl();
            }
        },
        getRecordPermissions: {
            async handler(record, userSession) {
                return this.object.getRecordPermissions(record, userSession);
            }
        },
        getRecordView: {
            async handler(userSession) {
                return await this.object.getRecordView(userSession);
            }
        },
        createDefaulRecordView: {
            async handler(userSession) {
                return await this.object.createDefaulRecordView(userSession);
            }
        },
        getDefaulRecordView: {
            async handler(userSession) {
                return await this.object.getDefaulRecordView(userSession);
            }
        },
        getRelateds: {
            async handler() {
                return await this.object.getRelateds();
            }
        },
        refreshIndexes: {
            async handler() {
                return await this.object.refreshIndexes();
            }
        }
        // getPageView: {
        //     //TODO
        // }
    };

    return methods;
}

function getObjectServiceActionsSchema() {
    const actions: any = {
        aggregate: {
            params: {
                query: { type: "object" },
                externalPipeline: { type: "array", items: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { query, externalPipeline } = ctx.params;
                return await this.aggregate(query, externalPipeline, userSession)
            }
        },
        find: {
            params: {
                fields: { type: 'array', items: "string", optional: true },
                filters: [{ type: 'array', optional: true }, { type: 'string', optional: true }],
                top: { type: 'number', optional: true },
                skip: { type: 'number', optional: true },
                sort: { type: 'string', optional: true }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                return this.find(ctx.params, userSession)
            }
        },
        findOne: {
            params: {
                id: { type: "any" },
                query: { type: "object", optional: true }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id, query } = ctx.params;
                return this.findOne(id, query, userSession)
            }
        },
        insert: {
            params: {
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { doc } = ctx.params;
                let data: any = '';
                if (_.isString(doc)) {
                    data = JSON.parse(doc);
                } else {
                    data = JSON.parse(JSON.stringify(doc));
                }
                let object = this.object;
                if (userSession && object.getField('space')) {
                    data.space = userSession.spaceId;
                }
                return this.insert(data, userSession)
            }
        },
        update: {
            params: {
                id: { type: "any" },
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id, doc } = ctx.params;
                let data: any = '';
                if (_.isString(doc)) {
                    data = JSON.parse(doc);
                } else {
                    data = JSON.parse(JSON.stringify(doc));
                }
                delete data.space;
                return this.update(id, data, userSession)
            }
        },
        updateOne: {
            params: {
                id: { type: "any" },
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id, doc } = ctx.params;
                let data: any = '';
                if (_.isString(doc)) {
                    data = JSON.parse(doc);
                } else {
                    data = JSON.parse(JSON.stringify(doc));
                }
                delete data.space;
                return this.updateOne(id, data, userSession)
            }
        },
        updateMany: {
            params: {
                queryFilters: { type: "array", items: "any" },
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { queryFilters, doc } = ctx.params;
                let data: any = '';
                if (_.isString(doc)) {
                    data = JSON.parse(doc);
                } else {
                    data = JSON.parse(JSON.stringify(doc));
                }
                delete data.space;
                return await this.updateMany(queryFilters, data, userSession)
            }
        },
        delete: {
            params: {
                id: { type: "any" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id } = ctx.params;
                return this.delete(id, userSession)
            }
        },
        directAggregate: {
            params: {
                query: { type: "object" },
                externalPipeline: { type: "array", items: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { query, externalPipeline } = ctx.params;
                return this.directAggregate(query, externalPipeline, userSession)
            }
        },
        directAggregatePrefixalPipeline: {
            params: {
                query: { type: "object" },
                prefixalPipeline: { type: "array", items: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { query, prefixalPipeline } = ctx.params;
                return this.directAggregatePrefixalPipeline(query, prefixalPipeline, userSession)
            }
        },
        directFind: {
            params: {
                fields: { type: 'array', items: "string", optional: true },
                filters: [{ type: 'array', optional: true }, { type: 'string', optional: true }],
                top: { type: 'number', optional: true },
                skip: { type: 'number', optional: true },
                sort: { type: 'string', optional: true }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                return this.directFind(ctx.params, userSession)
            }
        },
        directInsert: {
            params: {
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { doc } = ctx.params;
                return this.directInsert(doc, userSession)
            }
        },
        directUpdate: {
            params: {
                id: { type: "any" },
                doc: { type: "object" }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id, doc } = ctx.params;
                return this.directUpdate(id, doc, userSession)
            }
        },
        directDelete: {
            params: {
                id: { type: "any" },
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { id } = ctx.params;
                return this.directDelete(id, userSession)
            }
        },
        count: {
            rest: {
                method: "GET",
                path: "/count"
            },
            params: {
                fields: { type: 'array', items: "string", optional: true },
                filters: [{ type: 'array', optional: true }, { type: 'string', optional: true }],
                top: { type: 'number', optional: true },
                skip: { type: 'number', optional: true },
                sort: { type: 'string', optional: true }
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                return this.count(ctx.params, userSession)
            }
        },
        getField: {
            rest: {
                method: "GET",
                path: "/field"
            },
            params: {
                fieldApiName: { type: "string" },
            },
            async handler(ctx) {
                const { fieldApiName } = ctx.params;
                return this.getField(fieldApiName)
            }
        },
        getFields: {
            rest: {
                method: "GET",
                path: "/fields"
            },
            async handler(ctx) {
                return this.getFields()
            }
        },
        getNameFieldKey: {
            async handler(ctx) {
                return this.getNameFieldKey()
            }
        },
        toConfig: {
            async handler(ctx) {
                return this.toConfig()
            }
        },
        getUserObjectPermission: {
            rest: {
                method: "GET",
                path: "/getUserObjectPermission"
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                return this.getUserObjectPermission(userSession)
            }
        },
        isEnableAudit: {
            async handler() {
                return this.isEnableAudit();
            }
        },
        _makeNewID: {
            async handler() {
                return await this._makeNewID();
            }
        },
        getRecordAbsoluteUrl: {
            async handler() {
                return this.getRecordAbsoluteUrl();
            }
        },
        getGridAbsoluteUrl: {
            async handler() {
                return this.getGridAbsoluteUrl();
            }
        },
        getRecordPermissionsById: {
            rest: {
                method: "GET",
                path: "/recordPermissions/:recordId"
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { recordId } = ctx.params;
                const record = await this.findOne(recordId)
                return this.getRecordPermissions(record, userSession);
            }
        },
        getRecordPermissions: {
            async handler(ctx) {
                const userSession = ctx.meta.user;
                const { record } = ctx.params;
                return this.getRecordPermissions(record, userSession);
            }
        },
        getRecordView: {
            rest: {
                method: "GET",
                path: "/uiSchema"
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                return await this.getRecordView(userSession);
            }
        },
        createDefaulRecordView: {
            rest: {
                method: "POST",
                path: "/defUiSchema"
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                if(!userSession.is_space_admin){
                    throw new Error('no permission.')
                }
                return await this.createDefaulRecordView(userSession);
            }
        },
        getDefaulRecordView: {
            rest: {
                method: "GET",
                path: "/uiSchemaTemplate"
            },
            async handler(ctx) {
                const userSession = ctx.meta.user;
                if(!userSession.is_space_admin){
                    throw new Error('no permission.')
                }
                return await this.getDefaulRecordView(userSession);
            }
        },
        getRelateds: {
            rest: {
                method: "GET",
                path: "/relateds"
            },
            async handler(ctx) {
                return await this.getRelateds();
            }
        },
        refreshIndexes: {
            async handler(ctx) {
                return await this.refreshIndexes();
            }
        }
    };
    _.each(actions, function(action){
        delete action.params;
    });
    return actions;
}

export function getObjectServiceSchema(serviceName, objectConfig) {
    return {
        name: serviceName,
        actions: getObjectServiceActionsSchema(),
        methods: getObjectServiceMethodsSchema(),
        created() {
            this.object = new SteedosObjectType(objectConfig.name, getDataSource(objectConfig.datasource), objectConfig);
        }
    }
}

module.exports = {
    name: '#_objectBaseService', //TODO
    settings: {
        // objectApiName:  //TODO
        // objectConfig
    },
    actions: getObjectServiceActionsSchema(),
    methods: getObjectServiceMethodsSchema(),
    created(broker) {
        if (!this.settings.objectApiName && !this.settings.objectConfig) {
            throw new Error('Please set the settings.objectApiName.')
        }
        const objectConfig: any = this.settings.objectConfig || getObjectConfig(this.settings.objectApiName);
        if (!objectConfig) {
            throw new Error('Not found object config by objectApiName.')
        }
        const datasource = getDataSource(objectConfig.datasource);
        if (datasource) {
            this.object = datasource.getLocalObject(objectConfig.name);
            this.objectApiName = objectConfig.name;
        }
    },
    events: {
		"metadata.objects.deleted": {
            async handler(ctx) {
                const { objectApiName } = ctx.params
                const { onDestroyObjectService, objectConfig } = this.settings
				if(objectApiName === this.object.name){
                    _.each(objectConfig.fields, (field, name)=>{
                        if( (field.type === 'lookup' || field.type === 'master_detail') && (field.reference_to && _.isString(field.reference_to)) ){
                            ctx.broker.emit(`${getObjectServiceName(field.reference_to)}.refresh`, {});
                        }
                    })
                    // console.log(`ctx.broker.destroyService`, this.object.name);
                    ctx.broker.destroyService(this);
                    if(onDestroyObjectService && _.isFunction(onDestroyObjectService)){
                        onDestroyObjectService(objectApiName);
                    }
                    ctx.emit('$services.changed');
                }
            }
        }
    },
    merged(schema) {
        let settings = schema.settings;
        let objectConfig = settings.objectConfig;
        if (objectConfig.enable_api) {
            _.each(schema.actions, (action, actionName) => {
                let rest = generateActionRestProp(actionName);
                if (rest.method) {
                    action.rest = rest;
                }
            })
        }
        if (objectConfig.enable_graphql || true) { // TODO object.yml添加enable_graphql属性
            _.each(schema.actions, (action, actionName) => {
                let gpObj = generateActionGraphqlProp(actionName, objectConfig);
                if (!_.isEmpty(gpObj)) {
                    action.graphql = gpObj;
                }
            })
            settings.graphql = generateSettingsGraphql(objectConfig);
            dealWithRelatedFields(objectConfig, settings.graphql);
            let graphqlActions = getGraphqlActions(objectConfig);
            schema.actions = _.extend({}, graphqlActions, schema.actions);
        }
        if (!schema.events) {
            schema.events = {};
        }
        schema.events[`${getObjectServiceName(objectConfig.name)}.detailsChanged`] = {
            handler: async function (ctx) {
                const { objectApiName, detailObjectApiName, detailFieldName, detailFieldReferenceToFieldName } = ctx.params;
                let resolvers = this.settings.graphql.resolvers;
                let type: string = this.settings.graphql.type;
                let relatedFieldName = correctName(`${RELATED_PREFIX}_${detailObjectApiName}_${detailFieldName}`);
                let relatedType = _getRelatedType(relatedFieldName, detailObjectApiName);
                if (type.indexOf(relatedType) > -1) { // 防止重复定义field
                    return;
                }
                this.settings.graphql.type = type.substring(0, type.length - 1) + relatedType + '}';
                resolvers[objectApiName][relatedFieldName] = getRelatedResolver(objectApiName, detailObjectApiName, detailFieldName, detailFieldReferenceToFieldName);
            }
        };
        schema.events[`${getObjectServiceName(objectConfig.name)}.metadata.objects.inserted`] = {
            handler: async function (ctx) {
                let objectConfig = ctx.params.data;
                // 对象发生变化时，重新创建Steedos Object 对象
                const datasource = getDataSource(objectConfig.datasource);
                if (datasource) {
                    const localObjectConfig = getObjectConfig(objectConfig.name);
                    if(localObjectConfig){
                        objectConfig.listeners = localObjectConfig.listeners; 
                        objectConfig.methods = localObjectConfig.methods; 
                    }
                    const object = new SteedosObjectType(objectConfig.name, datasource, objectConfig)
                    datasource.setLocalObject(objectConfig.name, object);
                    this.object = object;

                    if (
                      datasource.name != "meteor" &&
                      datasource.name != "default"
                    ) {
                      await datasource.init();
                    }

                    if(datasource.name === 'meteor' && Creator.Objects[objectConfig.name]){
                        jsonToObject(objectConfig);
                        const localTriggers = (localObjectConfig as any).triggers;
                        if(localTriggers){
                            objectConfig.triggers = localTriggers; 
                        }
                        extend(objectConfig, {triggers: (localObjectConfig as any)._baseTriggers})
                        Creator.Objects[objectConfig.name] = objectConfig;
                        
                        await Future.task(() => {
                            try {
                                Creator.loadObjects(objectConfig, objectConfig.name);
                            } catch (error) {
                                this.logger.error('metadata.objects.inserted error', objectConfig.name, error)
                            }
                        }).promise();
                    }
                }
                
                let gobj = generateSettingsGraphql(objectConfig);
                this.settings.graphql = gobj;
                dealWithRelatedFields(objectConfig, this.settings.graphql);
                // TODO 重写 actions
                // let graphqlActions = getGraphqlActions(objectConfig);
                // schema.actions = _.extend({}, graphqlActions, schema.actions);
                ctx.emit('$services.changed');
            }
        }
        schema.events[`${getObjectServiceName(objectConfig.name)}.refresh`] = {
            handler: async function (ctx) {
                const _objectConfig = getObjectConfig(objectConfig.name);
                if(_objectConfig){
                    let gobj = generateSettingsGraphql(_objectConfig);
                    this.settings.graphql = gobj;
                    dealWithRelatedFields(_objectConfig, this.settings.graphql);
                }
            }
        }
    },
}
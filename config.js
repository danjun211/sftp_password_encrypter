"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const fse = require("fs-extra");
const path = require("path");
const Joi = require("joi");
const output = require("./output");
const Trie_1 = require("./Trie");
const host_1 = require("../host");
const logger_1 = require("../logger");
const configTrie = new Trie_1.default({}, {
    delimiter: path.sep,
});
const nullable = schema => schema.optional().allow(null);
const configScheme = {
    name: Joi.string(),
    context: Joi.string(),
    protocol: Joi.any().valid('sftp', 'ftp', 'local'),
    host: Joi.string().required(),
    port: Joi.number().integer(),
    connectTimeout: Joi.number().integer(),
    username: Joi.string().required(),
    password: nullable(Joi.string()),
    agent: nullable(Joi.string()),
    privateKeyPath: nullable(Joi.string()),
    passphrase: nullable(Joi.string().allow(true)),
    interactiveAuth: Joi.boolean().optional(),
    algorithms: Joi.any(),
    secure: Joi.any()
        .valid(true, false, 'control', 'implicit')
        .optional(),
    secureOptions: nullable(Joi.object()),
    passive: Joi.boolean().optional(),
    remotePath: Joi.string().required(),
    uploadOnSave: Joi.boolean().optional(),
    downloadOnOpen: Joi.boolean().optional(),
    syncMode: Joi.any().valid('update', 'full'),
    ignore: Joi.array()
        .min(0)
        .items(Joi.string()),
    watcher: {
        files: Joi.string()
            .allow(false, null)
            .optional(),
        autoUpload: Joi.boolean().optional(),
        autoDelete: Joi.boolean().optional(),
    },
    concurrency: Joi.number().integer(),
    isEncrypted: Joi.boolean().optional()
};
const defaultConfig = {
    name: null,
    protocol: 'sftp',
    host: 'host',
    port: 22,
    username: 'username',
    password: null,
    connectTimeout: 10000,
    agent: null,
    privateKeyPath: null,
    passphrase: null,
    interactiveAuth: false,
    secure: false,
    secureOptions: null,
    passive: false,
    // default to login dir
    remotePath: './',
    uploadOnSave: false,
    downloadOnOpen: false,
    syncMode: 'update',
    ignore: [],
    watcher: {
        files: false,
        autoUpload: false,
        autoDelete: false,
    },
    concurrency: 512,
    isEncrypted: false,
};
function normalizeTriePath(pathname) {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        const device = pathname.substr(0, 2);
        if (device.charAt(1) === ':') {
            // lowercase drive letter
            return pathname[0].toLowerCase() + pathname.substr(1);
        }
    }
    return path.normalize(pathname);
}
function addConfig(config, defaultContext) {
    const { error: validationError } = Joi.validate(config, configScheme, {
        convert: false,
        language: {
            object: {
                child: '!!prop "{{!child}}" fails because {{reason}}',
            },
        },
    });
    if (validationError) {
        throw new Error(`config validation fail: ${validationError.message}`);
    }
    // tslint:disable triple-equals
    let context = config.context != undefined ? config.context : defaultContext;
    context = normalizeTriePath(path.resolve(defaultContext, context));
    const withDefault = Object.assign({}, defaultConfig, config, { context });
    configTrie.add(context, withDefault);
    logger_1.default.info(`config at ${context}`, withDefault);
    return withDefault;
}
function getConfigPath(basePath) {
    return path.join(basePath, constants_1.CONFIG_PATH);
}
exports.getConfigPath = getConfigPath;
function loadConfig(configPath) {
    // $todo trie per workspace, so we can remove unused config
    return fse.readJson(configPath).then(config => {
        if(config.isEncrypted) {
            config.password = decrypt(config.password);
        }
    
        const configs = [].concat(config);
        const configContext = path.resolve(configPath, '../../');
        return configs.map(cfg => addConfig(cfg, configContext));
    });
}
exports.loadConfig = loadConfig;
function initConfigs(basePath) {
    const configPath = getConfigPath(basePath);
    return fse.pathExists(configPath).then(exist => {
        if (exist) {
            return loadConfig(configPath);
        }
        return [];
    }, _ => []);
}
exports.initConfigs = initConfigs;
function getConfig(activityPath) {
    const config = configTrie.findPrefix(normalizeTriePath(activityPath));
    if (!config) {
        throw new Error(`(${activityPath}) config file not found`);
    }
    if(config.isEncrypted) {
        config.password = decrypt(config.password);
    }
    
    return config;
}
exports.getConfig = getConfig;
function getAllConfigs() {
    if (configTrie === undefined) {
        return [];
    }
    return configTrie.getAllValues();
}
exports.getAllConfigs = getAllConfigs;
function getShortestDistinctConfigs() {
    if (configTrie === undefined) {
        return [];
    }
    return configTrie.findValuesWithShortestBranch();
}
exports.getShortestDistinctConfigs = getShortestDistinctConfigs;
function newConfig(basePath) {
    const configPath = getConfigPath(basePath);
    return fse
        .pathExists(configPath)
        .then(exist => {
        if (exist) {
            return host_1.showTextDocument(configPath);
        }
        return fse
            .outputJson(configPath, {
            protocol: defaultConfig.protocol,
            host: defaultConfig.host,
            username: defaultConfig.username,
            remotePath: defaultConfig.remotePath,
        }, { spaces: 4 })
            .then(() => host_1.showTextDocument(configPath));
    })
        .catch(error => {
        output.onError(error);
    });
}
exports.newConfig = newConfig;
function getHostInfo(config) {
    if(config.isEncrypted) {
        config.password = decrypt(config.password);
    }
    return {
        protocol: config.protocol,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        connectTimeout: config.connectTimeout,
        // sftp
        agent: config.agent,
        privateKeyPath: config.privateKeyPath,
        passphrase: config.passphrase,
        interactiveAuth: config.interactiveAuth,
        algorithms: config.algorithms,
        // ftp
        secure: config.secure,
        secureOptions: config.secureOptions,
        passive: config.passive,
    };
}
exports.getHostInfo = getHostInfo;
//# sourceMappingURL=config.js.map

// decrypter
const crypto = require("crypto");
const algorithm = "aes-256-cbc";

function decrypt(encryptedPassword, key = "sftp_password") {
    var decipher = crypto.createDecipher(algorithm, key);
    var decryptedPassword = decipher.update(encryptedPassword, "base64", "utf8");
    return decryptedPassword += decipher.final("utf8");
}
// end decrypter
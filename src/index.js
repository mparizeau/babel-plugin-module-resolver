var path = require('path');
var glob = require('glob');
var _ = require('lodash');

var pluginName = 'module-alias';
var filesMap = {};

function mapModule(context, module) {
    if (!_.keys(filesMap).length) {
        _.each(context.state.opts.extra[pluginName] || [], function (moduleMapData) {
            filesMap[moduleMapData.expose] = filesMap[moduleMapData.expose] || {
                src: moduleMapData.src,
                files: []
            };
            var src = path.join(moduleMapData.src, '**', '*');
            _.merge(filesMap[moduleMapData.expose].files, glob.sync(src));
        });
    }

    var moduleSplit = module.split('/');

    var src;
    while (moduleSplit.length) {
        var m = moduleSplit.join('/');
        if (filesMap.hasOwnProperty(m)) {
            src = filesMap[m].src;
            break;
        }
        moduleSplit.pop();
    }

    if (!moduleSplit.length) {
        return null;
    }

    var currentFile = context.state.opts.filename;

    var newPath = module.replace(moduleSplit.join('/'), src);
    var moduleMapped = path.relative(path.dirname(currentFile), path.normalize(newPath));
    if (moduleMapped[0] != '.') moduleMapped = './' + moduleMapped;

    return moduleMapped;
}


export default function({ Plugin, types: t }) {
    function transformRequireCall(context, call) {
        if(
            !t.isIdentifier(call.callee, {name: 'require'}) &&
                !(
                    t.isMemberExpression(call.callee) &&
                    t.isIdentifier(call.callee.object, {name: 'require'})
                )
        ) {
            return;
        }

        var moduleArg = call.arguments[0];
        if(moduleArg && moduleArg.type === 'Literal') {
            var module = mapModule(context, moduleArg.value);
            if(module) {
                return t.callExpression(call.callee, [t.literal(module)]);
            }
        }
    }

    function transformImportCall(context, call) {
        var moduleArg = call.source;
        if(moduleArg && moduleArg.type === 'Literal') {
            var module = mapModule(context, moduleArg.value);
            if(module) {
                return t.importDeclaration(
                    call.specifiers,
                    t.literal(module)
                );
            }
        }
    }

    return new Plugin(pluginName, {
        visitor: {
            CallExpression: {
                exit(node, parent, scope) {
                    return transformRequireCall(this, node);
                }
            },
            ImportDeclaration: {
                exit(node) {
                    return transformImportCall(this, node);
                }
            }
        }
    });
};

"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/functions-have-names";
exports.ids = ["vendor-chunks/functions-have-names"];
exports.modules = {

/***/ "(ssr)/./node_modules/functions-have-names/index.js":
/*!****************************************************!*\
  !*** ./node_modules/functions-have-names/index.js ***!
  \****************************************************/
/***/ ((module) => {

eval("\n\nvar functionsHaveNames = function functionsHaveNames() {\n\treturn typeof function f() {}.name === 'string';\n};\n\nvar gOPD = Object.getOwnPropertyDescriptor;\nif (gOPD) {\n\ttry {\n\t\tgOPD([], 'length');\n\t} catch (e) {\n\t\t// IE 8 has a broken gOPD\n\t\tgOPD = null;\n\t}\n}\n\nfunctionsHaveNames.functionsHaveConfigurableNames = function functionsHaveConfigurableNames() {\n\tif (!functionsHaveNames() || !gOPD) {\n\t\treturn false;\n\t}\n\tvar desc = gOPD(function () {}, 'name');\n\treturn !!desc && !!desc.configurable;\n};\n\nvar $bind = Function.prototype.bind;\n\nfunctionsHaveNames.boundFunctionsHaveNames = function boundFunctionsHaveNames() {\n\treturn functionsHaveNames() && typeof $bind === 'function' && function f() {}.bind().name !== '';\n};\n\nmodule.exports = functionsHaveNames;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvZnVuY3Rpb25zLWhhdmUtbmFtZXMvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWI7QUFDQSw4QkFBOEI7QUFDOUI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0I7QUFDL0I7QUFDQTs7QUFFQTs7QUFFQTtBQUNBLDhFQUE4RTtBQUM5RTs7QUFFQSIsInNvdXJjZXMiOlsid2VicGFjazovL2J1ZGJhc2UtZnJvbnRlbmQvLi9ub2RlX21vZHVsZXMvZnVuY3Rpb25zLWhhdmUtbmFtZXMvaW5kZXguanM/YWEwMyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBmdW5jdGlvbnNIYXZlTmFtZXMgPSBmdW5jdGlvbiBmdW5jdGlvbnNIYXZlTmFtZXMoKSB7XG5cdHJldHVybiB0eXBlb2YgZnVuY3Rpb24gZigpIHt9Lm5hbWUgPT09ICdzdHJpbmcnO1xufTtcblxudmFyIGdPUEQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yO1xuaWYgKGdPUEQpIHtcblx0dHJ5IHtcblx0XHRnT1BEKFtdLCAnbGVuZ3RoJyk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvLyBJRSA4IGhhcyBhIGJyb2tlbiBnT1BEXG5cdFx0Z09QRCA9IG51bGw7XG5cdH1cbn1cblxuZnVuY3Rpb25zSGF2ZU5hbWVzLmZ1bmN0aW9uc0hhdmVDb25maWd1cmFibGVOYW1lcyA9IGZ1bmN0aW9uIGZ1bmN0aW9uc0hhdmVDb25maWd1cmFibGVOYW1lcygpIHtcblx0aWYgKCFmdW5jdGlvbnNIYXZlTmFtZXMoKSB8fCAhZ09QRCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHR2YXIgZGVzYyA9IGdPUEQoZnVuY3Rpb24gKCkge30sICduYW1lJyk7XG5cdHJldHVybiAhIWRlc2MgJiYgISFkZXNjLmNvbmZpZ3VyYWJsZTtcbn07XG5cbnZhciAkYmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kO1xuXG5mdW5jdGlvbnNIYXZlTmFtZXMuYm91bmRGdW5jdGlvbnNIYXZlTmFtZXMgPSBmdW5jdGlvbiBib3VuZEZ1bmN0aW9uc0hhdmVOYW1lcygpIHtcblx0cmV0dXJuIGZ1bmN0aW9uc0hhdmVOYW1lcygpICYmIHR5cGVvZiAkYmluZCA9PT0gJ2Z1bmN0aW9uJyAmJiBmdW5jdGlvbiBmKCkge30uYmluZCgpLm5hbWUgIT09ICcnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbnNIYXZlTmFtZXM7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/functions-have-names/index.js\n");

/***/ })

};
;
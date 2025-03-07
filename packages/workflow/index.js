let designerRouter = require('./src/designerRouter').designerRouter;
let instanceFilesRouter = require('./src/instance_files').router;
const express = require('express');
const path = require('path');
exports.init = function ({ app }) {
    let desingerDir = path.dirname(require.resolve("@steedos/steedos-plugin-workflow/package.json"));
    app.use(designerRouter)
        .use('/applications', express.static(path.join(desingerDir, 'public')));
    app.use('/api/v4', instanceFilesRouter);
};
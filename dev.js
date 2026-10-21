// Development entry point. The packaged developer build sets the same flag
// through electron-builder.dev.yml.
process.env.CPPS_DEV_BUILD = '1';
require('./main');

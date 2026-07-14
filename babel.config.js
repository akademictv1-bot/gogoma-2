module.exports = function (api) {
    api.cache(true);

    const isProduction = process.env.NODE_ENV === 'production' || process.env.EAS_BUILD === 'true';

    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Remove todos os console.log/warn/error/info em builds de produção
            ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
        ],
    };
};

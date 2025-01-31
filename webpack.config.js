const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const isProduction = process.env.NODE_ENV == 'production';

const config = {
    entry: {
        index  : './src/tools/index/index.ts',

        router       : './src/tools/router/router.ts',
        pool_factory : './src/tools/pool_factory/pool_factory.ts',        
        pools        : './src/tools/pools/pools.ts',        
        nft          : './src/tools/nft/nft.ts',
        account      : './src/tools/account/account.ts',

        jetton       : './src/tools/jetton/jetton.ts',
        
        transaction: './src/tools/transaction/transaction.ts',       
    },
    output: {
        path: path.resolve(__dirname, 'public'),
    },
    devServer: {
        open: true,
        host: 'localhost',
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: './src/tools/index/index.html',
            chunks: ['index'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'pool_factory.html',
            template: './src/tools/pool_factory/pool_factory.html',
            chunks: ['pool_factory'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'jetton.html',
            template: './src/tools/jetton/jetton.html',
            chunks: ['jetton'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'router.html',
            template: './src/tools/router/router.html',
            chunks: ['router'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'pools.html',
            template: './src/tools/pools/pools.html',
            chunks: ['pools'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'nft.html',
            template: './src/tools/nft/nft.html',
            chunks: ['nft'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'account.html',
            template: './src/tools/account/account.html',
            chunks: ['account'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'transaction.html',
            template: './src/tools/transaction/transaction.html',
            chunks: ['transaction'], 
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),  
        new CopyWebpackPlugin({
            patterns: [
                { from: 'assets', to: 'assets' }
            ]
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'css', to: 'css' }
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: 'ts-loader',
                exclude: ['/node_modules/'],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js', '...'],
        fallback: {
            buffer: require.resolve('buffer/'),
        },
    }
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
    } else {
        config.mode = 'development';
    }
    return config;
};

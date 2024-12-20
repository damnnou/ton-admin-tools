const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const isProduction = process.env.NODE_ENV == 'production';

const config = {
    entry: {
        router: './src/tools/router/router.ts',
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
            filename: 'router.html',
            template: './src/tools/router/router.html',
            chunks: ['router'], 
        }),
        new HtmlWebpackPlugin({
            filename: 'transaction.html',
            template: './src/tools/transaction/transaction.html',
            chunks: ['transaction'], 
        }),
        new HtmlWebpackPlugin({
            template: './src/index.html',
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

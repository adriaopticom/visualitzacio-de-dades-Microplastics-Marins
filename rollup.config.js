import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'main.js',
  output: {
    file: 'bundle.js',
    format: 'iife',
    name: 'MicroplasticsViz',
    globals: {
      'd3': 'd3'
    }
  },
  external: ['d3'],
  plugins: [
    nodeResolve()
  ]
};

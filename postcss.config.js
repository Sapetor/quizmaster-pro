module.exports = {
  plugins: [
    require('autoprefixer')({
      // Support browsers from the last 2 versions and browsers with >1% market share
      // Perfect for LAN environments with potentially older browsers
      overrideBrowserslist: [
        'last 2 Chrome versions',
        'last 2 Firefox versions',
        'last 2 Safari versions',
        'last 2 Edge versions',
        'ie >= 11',
        '> 1%',
        'not dead'
      ],
      // Add prefixes for grid layout (important for older browsers)
      grid: 'autoplace',
      // Remove outdated prefixes
      remove: true
    }),
    // Minify CSS for production
    require('cssnano')({
      preset: ['default', {
        // Keep important comments (like license headers)
        discardComments: {
          removeAll: false,
        },
        // Don't merge rules that might break specificity
        mergeRules: false,
        // Keep z-index values as-is (don't optimize)
        zindex: false,
        // Preserve calc() expressions 
        calc: false
      }]
    })
  ]
};
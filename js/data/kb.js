/* Sample knowledge base loader: combines the two parts into importable docs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kb1.js'), require('./kb2.js'));
  else { root.SD = root.SD || {}; root.SD.sampleKB = factory(root.SD.kb1, root.SD.kb2); }
})(typeof self !== 'undefined' ? self : this, function (a, b) {
  return a.concat(b).map((x) => ({ id: x.id, title: x.title, category: x.category, updated: x.updated, keywords: x.keywords || [], text: x.body, source: 'sample', type: 'md' }));
});

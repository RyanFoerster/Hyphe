// L'adresse d'une page telle qu'on la sert. Au build, `format: 'file'` donne
// `/work/loum.html` et `/index.html` ; le visiteur, lui, lit `/work/loum` et `/`.
export const pagePath = (url: URL) => url.pathname.replace(/(\/index)?\.html$/, '') || '/';

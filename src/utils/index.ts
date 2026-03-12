export function createPageUrl(pageName: string) {
    const [page, ...rest] = pageName.split('?');
    const kebab = page
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/ /g, '-')
        .toLowerCase();
    const query = rest.length ? '?' + rest.join('?') : '';
    return '/' + kebab + query;
}
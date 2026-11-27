#!/usr/bin/env python3
"""Add three approved pages to the existing corporate security routing table.
No other server code is rewritten. Accept only the known four-route table.
"""
import re,sys
from pathlib import Path
ROUTES=[('/services/casual-consulting/','services/casual-consulting/index.html'),('/services/security-consulting/','services/security-consulting/index.html'),('/guide/','guide/index.html')]
OLD=[('/','index.html'),('/company/','company/index.html'),('/services/','services/index.html'),('/works/','works/index.html')]
def patch(s):
    tables=list(re.finditer(r'(?m)^(?P<indent>[ \t]*)const corporateRoutes\s*(?::\s*Array<\[string,\s*string\]>)?\s*=\s*\[\s*\n(?P<body>[\s\S]*?)\n(?P=indent)\];',s))
    if len(tables)!=1: raise ValueError('corporateRoutes missing or ambiguous')
    m=tables[0]; lines=m['body'].splitlines(); parsed=[]; patterns=[]
    for l in lines:
        row=re.fullmatch(r'([ \t]*)\[([\'\"])([^\'\"]+)\2,\s*([\'\"])([^\'\"]+)\4\],',l)
        if not row: raise ValueError('unexpected route table row: '+l)
        parsed.append((row[3],row[5]));patterns.append(row)
    if parsed!=OLD: raise ValueError('unexpected existing corporate routes')
    tail=s[m.end():]
    # Check the existing public transformation and header helper in the actual handler.
    handler=tail.split('app.use(',1)[0]
    for token in ('for (const [route, htmlPath] of corporateRoutes)', 'corporatePageSecurityHeaders', 'renderCorporatePage', 'isPublicRequest', 'readFile', 'res.redirect(301,', 'Cache-Control', 'no-cache'):
        if token not in handler: raise ValueError('existing corporate handler missing: '+token)
    for route, file in ROUTES:
        if route in s or file in s: raise ValueError('new route already present elsewhere: '+route)
    row=patterns[-1];new='\n'.join(f'{row[1]}[{row[2]}{route}{row[2]}, {row[4]}{file}{row[4]}],' for route,file in ROUTES)
    return s[:m.end('body')]+'\n'+new+s[m.end('body'):]
if __name__=='__main__':
    src,dst=map(Path,sys.argv[1:]); original=src.read_bytes(); updated=patch(original.decode('utf-8'));dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(updated.encode('utf-8'));print('CORPORATE_ROUTE_PATCH=PASS paths=3')

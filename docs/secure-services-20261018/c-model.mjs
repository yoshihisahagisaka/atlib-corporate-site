// C-40/C-50 extension. Existing cost functions and joint company distribution retained.
import fs from 'node:fs/promises';
import {cfg} from './model.mjs';
cfg.guardPlans[1]={name:'C Guard',bands:[[10,3500],[100,5000]]};
export * from './model.mjs';
export const mixes=[[1,0,0],[0,1,0],[0,0,1],[.4,.3,.3],[2/7,1.5/7,.5],[1.2/7,.9/7,.7]];
export const labels=['Guard単独','Send単独','パック単独','混在・パック30%','混在・パック50%','混在・パック70%'];
export const out='secure-services-business-analysis/docs/secure-services-20261018/c40-c50';
await fs.mkdir(out,{recursive:true});

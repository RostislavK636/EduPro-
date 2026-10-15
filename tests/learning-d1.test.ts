import {it,expect} from 'vitest';
import {withRuntime} from '../lib/runtime';
import {db} from '../lib/database';
import {attemptsFor} from '../lib/learning/service';
it('аналитика150учеников не превышает100 bind-параметров D1',async()=>{
  const counts:number[]=[];
  const binding={prepare(sql:string){return {bind(...args:unknown[]){counts.push(args.length);if(args.length>100)throw new Error('D1 bind limit');return this;},async all(){return {results:[],success:true,meta:{duration:0}};},async raw(){return [];}};}};
  await withRuntime({DB:binding as any},async()=>{try{expect(await attemptsFor(Array.from({length:150},(_,i)=>'student-'+i))).toEqual([]);}finally{await(await db()).$disconnect();}});
  expect(counts.length).toBeGreaterThanOrEqual(4);expect(Math.max(...counts)).toBeLessThanOrEqual(100);
});

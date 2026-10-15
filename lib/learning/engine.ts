import { z } from 'zod';
export const questionSchema=z.object({id:z.string().min(1).max(120),subject:z.string().min(1).max(100),topic:z.string().min(1).max(100),subtopic:z.string().min(1).max(100),level:z.number().int().min(1).max(3),kind:z.enum(['numeric','text']),prompt:z.string().min(5).max(3000),answer:z.string().min(1).max(300),criteria:z.string().min(3).max(1000),explanation:z.string().min(5).max(3000),knowledgeTags:z.array(z.string().min(1).max(60)).min(1).max(10),errorTags:z.array(z.string().min(1).max(60)).min(1).max(10)}).strict();
export type Question=z.infer<typeof questionSchema>;
export type Evidence={questionId:string;level:number;correct:boolean;errorTags?:string[]};
export const configSchema=z.object({medium:z.number().min(.1).max(.9),advanced:z.number().min(.2).max(1),up:z.number().int().min(2).max(6),down:z.number().int().min(2).max(6),diagnostic:z.literal(5),practice:z.number().int().min(6).max(30)}).refine(x=>x.medium<x.advanced,'Пороги должны возрастать');
export const DEFAULT_CONFIG={medium:.5,advanced:.8,up:3,down:2,diagnostic:5 as const,practice:10};
export const ALGORITHM_VERSION='rules-1.0';
export function diagnose(correct:number,total:number,c=DEFAULT_CONFIG):number { if(!total) return 1; const ratio=correct/total; return ratio>=c.advanced?3:ratio>=c.medium?2:1; }
export function decide(level:number,streak:boolean[],mode:string,c=DEFAULT_CONFIG) {
  if(mode==='fixed') return {level,reason:'Фиксированный режим: уровень не меняется.'};
  const tail=streak.at(-1); let n=0; for(let i=streak.length-1;i>=0&&streak[i]===tail;i--)n++;
  if(tail===true&&n>=c.up) return {level:Math.min(3,level+1),reason:level===3?'Верхняя граница: закрепление сложного уровня.':`${c.up} правильных подряд: повышение сложности.`};
  if(tail===false&&n>=c.down) return {level:Math.max(1,level-1),reason:level===1?'Нижняя граница: объяснение и закрепление основы.':`${c.down} ошибки подряд: снижение сложности.`};
  return {level,reason:'Недостаточно последовательных свидетельств для смены уровня.'};
}
export function mastery(history:Evidence[]) { const seen=new Map<string,number>();let total=2,success=1; for(const h of history) { const repeat=(seen.get(h.questionId)||0)+1;seen.set(h.questionId,repeat); const w=h.level/repeat;total+=w;if(h.correct)success+=w; }return success/total; }
export function mark(q:Question,answer:string) { const normalize=(s:string)=>s.trim().toLocaleLowerCase('ru').replace(/\s+/g,' '); if(!answer.trim())return false; if(q.kind==='numeric'){const a=answer.trim().replace(',','.');return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(a)&&Math.abs(Number(a)-Number(q.answer))<1e-8;}return normalize(answer)===normalize(q.answer); }
export function selectQuestion(pool:Question[],level:number,history:{questionId:string;correct:boolean;errorTags?:string[]}[],mode='adaptive',sequence=0):Question {
  if(!pool.length)throw new Error('Пустой банк');
  const recent=new Set(history.slice(-3).map(x=>x.questionId)); const counts=new Map<string,number>(); const errors=new Map<string,number>();
  for(const h of history){counts.set(h.questionId,(counts.get(h.questionId)||0)+1);if(!h.correct)for(const t of h.errorTags||[])errors.set(t,(errors.get(t)||0)+1);}
  const available=pool.filter(q=>!recent.has(q.id)); const candidates=available.length?available:pool;
  const target=mode==='fixed'?[1,2,3][sequence%3]:level;
  return [...candidates].sort((a,b)=>{
    const repeats=(q:Question)=>counts.get(q.id)||0;
    const matches=(q:Question)=>mode==='adaptive'?q.knowledgeTags.filter(t=>(errors.get(t)||0)>=2).length:0;
    return Math.abs(a.level-target)-Math.abs(b.level-target)||repeats(a)-repeats(b)||matches(b)-matches(a)||a.id.localeCompare(b.id);
  })[0];
}
export function summarize(history:Evidence[],mode='adaptive',c=DEFAULT_CONFIG) {
  let level=1;let streak:boolean[]=[];const decisions:{before:number;after:number;reason:string}[]=[];
  for(let i=0;i<history.length;i++){
    const before=level;let reason='Диагностика: собираем пять ответов.';
    if(i===c.diagnostic-1){level=diagnose(history.slice(0,c.diagnostic).filter(x=>x.correct).length,c.diagnostic,c);reason=`Диагностика ${history.slice(0,c.diagnostic).filter(x=>x.correct).length}/${c.diagnostic}: начальный уровень ${level}.`;}
    else if(i>=c.diagnostic){streak.push(history[i].correct);const d=decide(level,streak,mode,c);level=d.level;reason=d.reason;if((history[i].correct&&streak.slice(-c.up).length===c.up&&streak.slice(-c.up).every(Boolean))||(!history[i].correct&&streak.slice(-c.down).length===c.down&&streak.slice(-c.down).every(x=>!x)))streak=[];}
    decisions.push({before,after:level,reason});
  }
  const score=mastery(history);const mastered=history.length>=6&&score>=.8&&history.filter(x=>x.correct&&x.level>=2).length>=2;
  return {level,mastery:score,mastered,diagnosticDone:history.length>=c.diagnostic,completed:history.length>=c.diagnostic+c.practice,decisions};
}
export function recommendations(history:Evidence[]) {if(!history.length)return ['Пройдите диагностику: данных для персональных выводов пока нет.'];const errors=new Map<string,number>();for(const h of history)if(!h.correct)for(const t of h.errorTags||[])errors.set(t,(errors.get(t)||0)+1);const repeated=[...errors].sort((a,b)=>b[1]-a[1]).slice(0,3);return [...repeated.map(([tag,n])=>`Повторите «${tag}»: ${n} ошибочных ответов с этой меткой.`),history.length<10?'Малая выборка (<10 ответов): выводы предварительные.':'Сравните последние попытки с предыдущими; показатель mastery не является оценкой способностей.'];}

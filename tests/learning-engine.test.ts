import { describe, it, expect } from 'vitest';
import { diagnose, decide, mastery, selectQuestion, mark, DEFAULT_CONFIG } from '../lib/learning/engine';
import { BANK } from '../lib/learning/bank';

describe('Правила адаптации — заранее заданные сценарии', () => {
  it.each([[0,1],[2,1],[3,2],[4,3],[5,3]])('диагностика %i из5 → уровень%i', (correct,level) => expect(diagnose(correct,5,DEFAULT_CONFIG)).toBe(level));
  it('точная граница50% относится к среднему', () => expect(diagnose(1,2,DEFAULT_CONFIG)).toBe(2));
  it('пороги можно изменить', () => expect(diagnose(3,5,{...DEFAULT_CONFIG,medium:.7,advanced:.9})).toBe(1));
  it('три правильных повышают уровень', () => expect(decide(1,[true,true,true], 'adaptive').level).toBe(2));
  it('две ошибки снижают уровень', () => expect(decide(3,[false,false], 'adaptive').level).toBe(2));
  it('чередование не повышает уровень', () => expect(decide(2,[true,false,true,false,true], 'adaptive').level).toBe(2));
  it('верхняя граница3', () => expect(decide(3,[true,true,true], 'adaptive').level).toBe(3));
  it('нижняя граница1', () => expect(decide(1,[false,false], 'adaptive').level).toBe(1));
  it('фиксированный режим не адаптирует уровень', () => expect(decide(2,[false,false], 'fixed').level).toBe(2));
  it('априорный mastery при пустой истории 0.5', () => expect(mastery([])).toBe(.5));
  it('сложное правильное решение весит больше простого', () => { expect(mastery([{questionId:'a',level:3,correct:true}])).toBe(.8); expect(mastery([{questionId:'a',level:1,correct:true}])).toBeCloseTo(2/3); });
  it('повтор дисконтируется', () => expect(mastery([{questionId:'a',level:1,correct:true},{questionId:'a',level:1,correct:true}])).toBeCloseTo(2.5/3.5));
  it('выбор не повторяет последнее задание при наличии новых', () => { const q=BANK[0]; expect(selectQuestion(BANK.filter(x=>x.topic===q.topic),1,[{questionId:q.id,correct:false,errorTags:q.errorTags}]).id).not.toBe(q.id); });
  it('два одинаковых типа ошибок дают целевое повторение', () => { const pool=BANK.filter(x=>x.topic==='fractions'); const q=selectQuestion(pool,1,[{questionId:'old1',correct:false,errorTags:['fractions']},{questionId:'old2',correct:false,errorTags:['fractions']}]); expect(q.knowledgeTags).toContain('fractions'); });
  it('банк содержит уникальные id и все уровни по каждой теме', () => { expect(new Set(BANK.map(x=>x.id)).size).toBe(BANK.length); for(const t of new Set(BANK.map(x=>x.topic))) expect(new Set(BANK.filter(x=>x.topic===t).map(x=>x.level))).toEqual(new Set([1,2,3])); });
  it('принимает десятичную запятую, но не пустой/произвольный ответ', () => { const q={...BANK[0],answer:'1.5'}; expect(mark(q,'1,5')).toBe(true); expect(mark(q,'')).toBe(false); expect(mark(q,'1.5abc')).toBe(false); });
  it('долгая история повторов не меняет целевой уровень диагностики',()=>{const pool=BANK.filter(q=>q.topic==='fractions');const history=pool.filter(q=>q.level===1).flatMap(q=>Array.from({length:20},()=>({questionId:q.id,correct:false,errorTags:q.errorTags})));expect(selectQuestion(pool,1,history).level).toBe(1);});
});

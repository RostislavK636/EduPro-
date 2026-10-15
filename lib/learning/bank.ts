import type { Question } from './engine';
export const TOPICS=[{id:'fractions',subject:'Математика',name:'Дроби и проценты',description:'Доли, проценты и последовательные изменения'},{id:'equations',subject:'Математика',name:'Линейные уравнения',description:'От одного действия до уравнения со скобками'},{id:'algorithms',subject:'Информатика',name:'Алгоритмы и циклы',description:'Переменные, повторения и вложенные циклы'},{id:'binary',subject:'Информатика',name:'Системы счисления',description:'Двоичные числа, перевод и арифметика'}];
const bank:Question[]=[];
// Детерминированные семейства с аналитически вычисленными эталонами. Не AI-генерация.
for(const t of TOPICS)for(let level=1;level<=3;level++)for(let n=1;n<=6;n++){
  let prompt='',answer=0,explanation='';
  if(t.id==='fractions'){
    if(level===1){answer=n+5;prompt=`Найдите 1/${n+1} от числа ${(n+1)*answer}.`;explanation=`Разделите целое ${(n+1)*answer} на знаменатель ${n+1}: получится ${answer}.`;}
    if(level===2){prompt=`Найдите ${n*5}% от числа 200.`;answer=n*10;explanation=`Один процент от 200 равен 2. Умножьте 2 на ${n*5}: ${answer}.`;}
    if(level===3){prompt=`Цена ${n*100} руб. сначала выросла на 20%, затем снизилась на 25%. Какова итоговая цена в рублях?`;answer=n*90;explanation=`Последовательные изменения перемножаются: ${n*100} × 1,2 × 0,75 = ${answer}. Проценты относятся к разным основаниям.`;}
  } else if(t.id==='equations'){
    const x=n+2;if(level===1){prompt=`Решите x + ${n} = ${x+n}. Укажите x.`;answer=x;explanation=`Вычтите ${n} из обеих частей: x = ${x}.`;}
    if(level===2){prompt=`Решите ${n+1}x − ${n} = ${(n+1)*x-n}. Укажите x.`;answer=x;explanation=`Прибавьте ${n}, затем разделите на ${n+1}: x = ${x}.`;}
    if(level===3){prompt=`Решите 3(x + ${n}) − 2x = ${x+3*n}. Укажите x.`;answer=x;explanation=`Раскройте скобки: 3x + ${3*n} − 2x = ${x+3*n}. Приведите подобные и вычтите ${3*n}: x = ${x}.`;}
  } else if(t.id==='algorithms'){
    if(level===1){prompt=`x = ${n}; затем x = x + 3. Каково итоговое x?`;answer=n+3;explanation=`Новое значение заменяет старое: ${n} + 3 = ${answer}.`;}
    if(level===2){prompt=`s = 0. Повторить ${n+2} раз: s = s + 2. Чему равно s?`;answer=(n+2)*2;explanation=`Каждое из ${n+2} повторений прибавляет 2: s = ${answer}.`;}
    if(level===3){prompt=`s = 0. Внешний цикл ${n+1} раз, внутри каждый раз цикл 3 раза: s = s + 2. Итоговое s?`;answer=(n+1)*6;explanation=`Всего ${(n+1)*3} внутренних итераций, в каждой прибавляется 2: s = ${answer}.`;}
  } else {
    if(level===1){prompt=`Переведите двоичное число ${(n+2).toString(2)} в десятичное.`;answer=n+2;explanation=`Сложите веса разрядов 1, 2, 4, ... там, где стоит единица: ${answer}.`;}
    if(level===2){prompt=`Чему равна в десятичной системе сумма двоичных чисел ${(n+5).toString(2)} и 101?`;answer=n+10;explanation=`Первое число равно ${n+5}, число 101₂ равно 5; сумма ${answer}.`;}
    if(level===3){prompt=`Двоичное число ${(n+3).toString(2)} сдвинули влево на 2 разряда (без переполнения). Укажите десятичное значение.`;answer=(n+3)*4;explanation=`Сдвиг влево на два разряда умножает неотрицательное число на 4: ${n+3} × 4 = ${answer}.`;}
  }
  bank.push({id:`${t.id}-${level}-${n}`,subject:t.subject,topic:t.id,subtopic:`${t.id}-L${level}`,level,kind:'numeric',prompt,answer:String(answer),criteria:'Точное числовое значение; десятичная точка и запятая равнозначны. Единицы в ответ не включать.',explanation,knowledgeTags:[t.id,`${t.id}-L${level}`],errorTags:[t.id,`${t.id}-L${level}`]});
}
export const BANK:Question[]=bank;

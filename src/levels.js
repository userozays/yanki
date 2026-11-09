/* YANKI — bölümler.
   # duvar  . zemin  S başlangıç  @ çekirdek  a-d plaka  A-D kapı  1-4 ters kapı  x sandık  ~ çürük zemin */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YankiLevels = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return [
    {
      id: 'ilk-adim', name: 'İlk Adım', T: 10,
      tip: 'Ok tuşları ya da WASD ile yürü. Işıyan çekirdeğe ulaş.',
      map: [
        '########',
        '#S..#..#',
        '#.#...@#',
        '#...#..#',
        '########',
      ],
    },
    {
      id: 'yanki', name: 'Yankı', T: 10,
      tip: 'Plakaya basınca kapı açılır, inince kapanır. Plakada dururken R’ye bas: zaman başa sarar ve bu halin, yankın olarak aynısını yapar.',
      map: [
        '##########',
        '#S...a...#',
        '####.#####',
        '   #A#    ',
        '   #@#    ',
        '   ###    ',
      ],
    },
    {
      id: 'sandik', name: 'Sandık', T: 14,
      tip: 'Sandıklar da plakaya basar. Üstelik hiç yorulmazlar.',
      map: [
        '##########',
        '#S.......#',
        '#..x..a..#',
        '#........#',
        '#####A####',
        '    #@#   ',
        '    ###   ',
      ],
    },
    {
      id: 'zamanlama', name: 'Zamanlama', T: 12,
      tip: 'Çizgili kapı ters çalışır: plaka basılıyken kapanır. Yankın doğru anda basmalı, doğru anda çekilmeli.',
      map: [
        '#########',
        '#S.a#####',
        '#.#######',
        '#.A..1.@#',
        '#########',
      ],
    },
    {
      id: 'ritim', name: 'Ritim', T: 11,
      tip: 'Bas, çekil, bas, çekil. Kapıda beklemek serbest; ama en kısa yol bir ritim ister.',
      map: [
        '#############',
        '#.a.S..A1A1@#',
        '#############',
      ],
    },
    {
      id: 'kopru', name: 'Köprü', T: 10,
      tip: 'İki çekirdek aynı anda dolmalı. Çürük zemin, üstünden son kişi ayrılınca çöker: kendinle birlikte yürü.',
      map: [
        '#########',
        '#...#..@#',
        '#S..~~..#',
        '#...#..@#',
        '#########',
      ],
    },
    {
      id: 'guven', name: 'Güven', T: 12,
      tip: 'Üç yankıyla kolay. İkiyle çözmek için Tab ile yankılar arasında geç ve her birinin kaydını sürdür: biri ötekine, öteki de ona kapı açsın.',
      map: [
        '###########',
        '#b.A.S.a..#',
        '#########B#',
        '        #@#',
        '        ###',
      ],
    },
    {
      id: 'kapi-tutan', name: 'Kapı Tutan', T: 14,
      tip: 'Bir kapı, içinde biri dururken kapanamaz. Kapıyı bedeninle tut.',
      map: [
        '#########',
        '#S..a...#',
        '######A##',
        '    #@.@#',
        '    #####',
      ],
    },
    {
      id: 'kargo', name: 'Kargo', T: 20,
      tip: 'Sandığı kapıdan geçir. Kalıcı bir ağırlık, bir yankıyı serbest bırakır.',
      map: [
        '##########',
        '#S..a#####',
        '#..x.A.b##',
        '#....#####',
        '##B#######',
        '#@.@#     ',
        '#####     ',
      ],
    },
    {
      id: 'zincir', name: 'Zincir', T: 12,
      tip: 'Herkes bir sonrakine kapı açar. Bazı yolların dönüşü yoktur.',
      map: [
        '#############',
        '#a~S..A...B@#',
        '#######.#####',
        '      #b#    ',
        '      ###    ',
      ],
    },
    {
      id: 'bekci', name: 'Bekçi', T: 20,
      tip: 'Köprü, üstünde biri durdukça ayakta kalır. Herkes çekirdeğe varmak zorunda değil.',
      map: [
        '#############',
        '#S..a.~..A.@#',
        '##########.##',
        '         #@# ',
        '         ### ',
      ],
    },
    {
      id: 'koro', name: 'Koro', T: 12,
      tip: 'Her kapının anahtarı bir başkasının ayağının altında. Hepiniz, aynı anda.',
      map: [
        '    ###        ',
        '    #@#        ',
        '    #A#        ',
        '    #b#        ',
        '    #.#        ',
        '    #.#        ',
        '#####.#########',
        '#@Ca.S.....cB@#',
        '###############',
      ],
    },
  ];
});

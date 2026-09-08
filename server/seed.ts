import { Data, uid, validate, Entity } from '../lib/domain';
import { db, stmt, now, insertEntity } from './store';
export async function createEvent(
  user: Data,
  input: Data,
  demo = false,
  populateDemo = false,
) {
  const id = uid(),
    wid = input.workspace_id || uid(),
    time = now();
  const event: Data = {
    date: input.date || '',
    timezone: input.timezone || 'Europe/Bucharest',
    city: input.city || '',
    venue: input.venue || '',
    expected: Number(input.expected || 120),
    budget: Number(input.budget || 0),
    currency: input.currency || 'RON',
    language: input.language || 'ro',
    style: 'Elegant',
    app_name: 'NuntaNoastră',
    demo,
    partner1: input.partner1 || '',
    partner2: input.partner2 || '',
    status: 'active',
    ...input,
  };
  delete event.workspace_id;
  const statements: D1PreparedStatement[] = [];
  if (!input.workspace_id)
    statements.push(
      stmt(
        'INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)',
        wid,
        input.workspace_name || 'Spațiul nostru',
        time,
      ),
      stmt(
        'INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,?)',
        wid,
        user.id,
        'owner',
      ),
    );
  statements.push(
    stmt(
      'INSERT INTO events(id,workspace_id,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      id,
      wid,
      input.name ||
        [event.partner1, event.partner2].filter(Boolean).join(' & ') ||
        'Nunta noastră',
      JSON.stringify(event),
      time,
      time,
    ),
  );
  const entities: Entity[] = [];
  const add = (kind: string, data: Data) => {
    const d = validate(kind, data);
    const record = insertEntity(id, kind, d, user.id);
    statements.push(...record.statements);
    entities.push({
      id: record.id,
      event_id: id,
      kind,
      data: d,
      version: 1,
      created_at: time,
      updated_at: time,
    });
    return record.id;
  };
  const subs = [
    'Cununie civilă',
    'Ceremonie religioasă',
    'Recepție & petrecere',
  ].map((name, i) =>
    add('subevent', {
      name,
      date: event.date,
      start: ['12:00', '15:00', '18:00'][i],
      end: ['13:00', '16:00', '23:59'][i],
      venue: demo
        ? [
            'Casa Căsătoriilor · demo',
            'Capela Grădinii · demo',
            'Domeniul Magnolia · demo',
          ][i]
        : '',
    }),
  );
  const menus = [
    'Meniu clasic',
    'Vegetarian',
    'Meniu pentru copii',
    'Vegan',
  ].map((name) => add('menu', { name, price: 0, currency: event.currency }));
  [
    'Stabiliți bugetul',
    'Alegeți locația',
    'Definitivați lista de invitați',
    'Trimiteți invitațiile',
    'Confirmați meniurile',
    'Pregătiți planul meselor',
  ].forEach((name, i) =>
    add('task', {
      name,
      status:
        demo && populateDemo && i < 2 ? 'done' : i === 2 ? 'progress' : 'todo',
      priority: i === 4 ? 'high' : 'normal',
      assignee: demo ? (i % 2 ? 'Andrei' : 'Sofia') : '',
      due: event.date
        ? new Date(Date.parse(event.date) - (120 - i * 20) * 86400000)
            .toISOString()
            .slice(0, 10)
        : '',
    }),
  );
  add('invitation', {
    name: 'O zi de neuitat, împreună',
    style: 'Elegant',
    message:
      'Cu inimile pline de bucurie, vă invităm să ne fiți alături în ziua în care povestea noastră devine pentru totdeauna.',
    message_en:
      'With joyful hearts, we invite you to celebrate the beginning of our forever.',
    color: '#536b57',
    dress_code: 'Cocktail / elegant',
    rsvp_deadline: event.date
      ? new Date(Date.parse(event.date) - 30 * 86400000)
          .toISOString()
          .slice(0, 10)
      : '',
    help: demo ? 'sofia.andrei@example.invalid' : '',
  });
  if (demo && populateDemo) {
    const tables = Array.from({ length: 12 }, (_, i) =>
      add('table', {
        name: i === 0 ? 'Masa mirilor' : `Masa ${String(i).padStart(2, '0')}`,
        subevent_id: subs[2],
        capacity: i === 0 ? 6 : i % 3 === 0 ? 10 : 8,
        shape: i === 0 ? 'head' : i % 4 === 0 ? 'rectangle' : 'round',
        x: 60 + (i % 4) * 195,
        y: 60 + Math.floor(i / 4) * 190,
        rotation: 0,
      }),
    );
    add('decor', {
      name: 'Ring de dans',
      type: 'Ring de dans',
      x: 310,
      y: 650,
      width: 230,
      height: 120,
    });
    const first = [
      'Ana',
      'Mihai',
      'Elena',
      'Alexandru',
      'Ioana',
      'Radu',
      'Maria',
      'Vlad',
      'Diana',
      'Ștefan',
      'Irina',
      'Matei',
      'Andreea',
      'Victor',
      'Bianca',
      'Paul',
      'Oana',
      'Gabriel',
      'Laura',
      'Tudor',
    ];
    const last = [
      'Popescu',
      'Ionescu',
      'Dumitrescu',
      'Georgescu',
      'Marin',
      'Stan',
      'Dobre',
      'Rusu',
      'Enache',
      'Ilie',
      'Petrescu',
      'Toma',
      'Sandu',
      'Munteanu',
      'Neagu',
      'Drăgan',
      'Barbu',
      'Nistor',
      'Florea',
      'Avram',
    ];
    let n = 0,
      seatIndex = 0;
    for (let family = 0; n < 120; family++) {
      const size = Math.min([2, 3, 1, 4, 2, 2, 3][family % 7], 120 - n);
      const household = add('household', {
        name: `Familia ${last[family % last.length]} ${family + 1}`,
        email: `familia${family + 1}@example.invalid`,
        language: 'ro',
        max_companions: family % 8 === 0 ? 1 : 0,
      });
      for (let j = 0; j < size; j++, n++) {
        const guest = add('guest', {
          name: `${first[n % first.length]} ${last[family % last.length]}`,
          household_id: household,
          age: j > 1 ? 'copil' : 'adult',
          relationship: ['Mireasă', 'Mire', 'Prieteni comuni'][family % 3],
          menu_id: menus[j > 1 ? 2 : n % 13 === 0 ? 1 : 0],
          email: j === 0 ? `invitat${n}@example.invalid` : '',
          allergies: n % 29 === 0 ? 'Nuci' : '',
          transport: n % 7 === 0,
          accommodation: n % 9 === 0,
          tags: family % 4 === 0 ? 'Familie' : '',
        });
        for (const sub of subs) {
          add('guest_invitation', { guest_id: guest, subevent_id: sub });
          add('rsvp', {
            guest_id: guest,
            subevent_id: sub,
            status: n < 86 ? 'confirmed' : n < 96 ? 'declined' : 'pending',
            source: 'organizer',
          });
        }
        if (n < 74) {
          let remaining = seatIndex,
            ti = 0;
          while (
            remaining >=
            entities.find((e) => e.id === tables[ti])!.data.capacity
          ) {
            remaining -= entities.find((e) => e.id === tables[ti])!.data
              .capacity;
            ti++;
          }
          const a = insertEntity(
            id,
            'assignment',
            {
              guest_id: guest,
              table_id: tables[ti],
              seat: remaining + 1,
              subevent_id: subs[2],
              provisional: false,
            },
            user.id,
          );
          statements.push(...a.statements);
          seatIndex++;
        }
      }
    }
    const categories = [
      'Locație',
      'Catering',
      'Foto/video',
      'Muzică',
      'Flori și decor',
      'Ținute',
      'Verighete',
      'Transport',
      'Papetărie',
      'Rezervă',
    ];
    const names = [
      'Domeniul Magnolia',
      'Atelier de Gust',
      'Lumină Studio',
      'The September Band',
      'Verde Atelier',
      'Maison de Soie',
      'Atelier Aur',
      'Drum Bun',
    ];
    categories.forEach((category, i) => {
      const vendor =
        i < 8
          ? add('vendor', {
              name: names[i] + ' · demo',
              category,
              status: i < 5 ? 'contracted' : 'offer',
              contact: 'Contact demonstrativ',
              email: `furnizor${i}@example.invalid`,
              price:
                [18000, 48000, 8500, 12000, 6500, 6000, 4500, 2500][i] * 100,
              currency: 'RON',
            })
          : '';
      const contracted =
        [18000, 42000, 8500, 12000, 6500, 6000, 4500, 2500, 1200, 0][i] * 100;
      const expense = add('expense', {
        name: category,
        category,
        vendor_id: vendor,
        estimated: contracted,
        contracted,
        currency: 'RON',
      });
      if (i < 5) {
        const amount = Math.floor(contracted * 0.3);
        const p = add('payment', {
          name: `Avans ${category.toLowerCase()}`,
          expense_id: expense,
          amount,
          currency: 'RON',
          date: '2026-06-12',
          method: 'Transfer bancar',
          payer: 'Sofia & Andrei',
          beneficiary: names[i],
        });
        if (i === 4)
          add('refund', {
            name: 'Ajustare decor · demo',
            payment_id: p,
            amount: 35000,
            currency: 'RON',
            date: '2026-08-20',
          });
        add('schedule', {
          name: `Sold ${category.toLowerCase()}`,
          expense_id: expense,
          amount: contracted - amount,
          currency: 'RON',
          due: [
            '2026-09-15',
            '2026-09-18',
            '2026-10-17',
            '2026-10-15',
            '2026-09-05',
          ][i],
        });
      }
    });
    [
      'Pregătiri & fotografii',
      'Cununia civilă',
      'Ceremonia religioasă',
      'Primirea invitaților',
      'Primul dans',
    ].forEach((name, i) =>
      add('timeline', {
        name,
        date: event.date,
        start: ['10:00', '12:00', '15:00', '18:00', '20:00'][i],
        end: ['11:30', '13:00', '16:00', '19:00', '20:15'][i],
        venue: i > 2 ? 'Domeniul Magnolia' : 'București',
        assignee: 'Andrei',
      }),
    );
    add('transport', {
      name: 'Microbuz · Centru → Magnolia',
      pickup: 'Piața Universității',
      date: event.date,
      time: '17:00',
      capacity: 20,
    });
    add('accommodation', {
      name: 'Vila Magnolia · Camera 1',
      capacity: 2,
      start: event.date,
      end: new Date(Date.parse(event.date) + 86400000)
        .toISOString()
        .slice(0, 10),
      price: 35000,
      currency: 'RON',
      payer: 'Mirii',
    });
    add('notification', {
      name: 'Bine ați venit! Acest eveniment folosește exclusiv date fictive.',
      read: false,
    });
    const campaign = insertEntity(
      id,
      'campaign',
      {
        name: 'Invitația noastră · rezultate simulate',
        channel: 'email',
        type: 'invitation',
        status: 'simulated',
      },
      user.id,
    );
    statements.push(...campaign.statements);
    for (let i = 0; i < 8; i++)
      statements.push(
        stmt(
          'INSERT INTO jobs(id,event_id,campaign_id,household_id,channel,type,payload,due_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          uid(),
          id,
          campaign.id,
          entities.filter((x) => x.kind === 'household')[i].id,
          'email',
          'invitation',
          JSON.stringify({
            simulated: true,
            result: ['delivered', 'accepted', 'failed', 'unknown'][i % 4],
          }),
          time,
          'simulated',
          time,
          time,
        ),
      );
  }
  // D1 imposes bounded batch sizes. The event is only returned after seed completion.
  for (let i = 0; i < statements.length; i += 80)
    await db().batch(statements.slice(i, i + 80));
  return id;
}

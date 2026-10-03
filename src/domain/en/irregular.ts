/**
 * Verbes irréguliers anglais : prétérit et participe passé.
 *
 * Une table écrite à la main, limitée aux verbes courants. Un verbe absent
 * n'est **pas** présumé régulier : l'app n'affiche alors aucune forme,
 * plutôt que d'en déduire une fausse (*stopped* et *visited* ne suivent pas
 * la même règle, et la table ne connaît pas tous les irréguliers).
 *
 * Format : « base prétérit participe », variantes séparées par « / ».
 */
const TABLE = `
arise arose arisen
awake awoke awoken
be was/were been
bear bore borne
beat beat beaten
become became become
begin began begun
bend bent bent
bet bet bet
bind bound bound
bite bit bitten
bleed bled bled
blow blew blown
break broke broken
breed bred bred
bring brought brought
broadcast broadcast broadcast
build built built
burn burnt/burned burnt/burned
burst burst burst
buy bought bought
cast cast cast
catch caught caught
choose chose chosen
cling clung clung
come came come
cost cost cost
creep crept crept
cut cut cut
deal dealt dealt
dig dug dug
dive dived/dove dived
do did done
draw drew drawn
dream dreamt/dreamed dreamt/dreamed
drink drank drunk
drive drove driven
eat ate eaten
fall fell fallen
feed fed fed
feel felt felt
fight fought fought
find found found
flee fled fled
fling flung flung
fly flew flown
forbid forbade forbidden
foresee foresaw foreseen
forget forgot forgotten
forgive forgave forgiven
freeze froze frozen
get got got/gotten
give gave given
go went gone
grind ground ground
grow grew grown
hang hung hung
have had had
hear heard heard
hide hid hidden
hit hit hit
hold held held
hurt hurt hurt
keep kept kept
kneel knelt knelt
know knew known
lay laid laid
lead led led
lean leant/leaned leant/leaned
leap leapt/leaped leapt/leaped
learn learnt/learned learnt/learned
leave left left
lend lent lent
let let let
lie lay lain
light lit lit
lose lost lost
make made made
mean meant meant
meet met met
mistake mistook mistaken
outgrow outgrew outgrown
overcome overcame overcome
overtake overtook overtaken
pay paid paid
prove proved proven/proved
put put put
quit quit quit
read read read
ride rode ridden
ring rang rung
rise rose risen
run ran run
say said said
see saw seen
seek sought sought
sell sold sold
send sent sent
set set set
sew sewed sewn
shake shook shaken
shed shed shed
shine shone shone
shoot shot shot
show showed shown
shrink shrank shrunk
shut shut shut
sing sang sung
sink sank sunk
sit sat sat
sleep slept slept
slide slid slid
smell smelt/smelled smelt/smelled
speak spoke spoken
speed sped sped
spell spelt/spelled spelt/spelled
spend spent spent
spill spilt/spilled spilt/spilled
spin spun spun
spit spat spat
split split split
spoil spoilt/spoiled spoilt/spoiled
spread spread spread
spring sprang sprung
stand stood stood
steal stole stolen
stick stuck stuck
sting stung stung
stink stank stunk
strike struck struck
strive strove striven
swear swore sworn
sweep swept swept
swell swelled swollen
swim swam swum
swing swung swung
take took taken
teach taught taught
tear tore torn
tell told told
think thought thought
throw threw thrown
tread trod trodden
undergo underwent undergone
understand understood understood
undertake undertook undertaken
upset upset upset
wake woke woken
wear wore worn
weave wove woven
weep wept wept
win won won
wind wound wound
withdraw withdrew withdrawn
withhold withheld withheld
wring wrung wrung
write wrote written
`;

export interface IrregularForms {
  past: string;
  participle: string;
}

const IRREGULAR: ReadonlyMap<string, IrregularForms> = new Map(
  TABLE.trim()
    .split('\n')
    .map((line) => {
      const [base, past, participle] = line.trim().split(/\s+/);
      return [base!, { past: past!.replace(/\//g, ' / '), participle: participle!.replace(/\//g, ' / ') }];
    }),
);

/** Formes irrégulières d'un verbe de base, ou `null` s'il n'est pas dans la table. */
export function irregularForms(base: string): IrregularForms | null {
  return IRREGULAR.get(base.trim().toLowerCase()) ?? null;
}

export const IRREGULAR_COUNT = IRREGULAR.size;

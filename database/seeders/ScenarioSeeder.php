<?php

namespace Database\Seeders;

use App\Models\Scenario;
use Illuminate\Database\Seeder;

class ScenarioSeeder extends Seeder
{
    public function run(): void
    {
        $scenarios = [
            [
                'name' => '打招呼',
                'slug' => 'greetings',
                    'emoji' => '👋',
                    'color' => 'sun',
                'level' => 1,
                'description' => '练习打招呼与自我介绍：名字、心情、年龄',
                'target_vocab' => ['hello', 'hi', 'name', 'fine', 'happy', 'years old', 'color', 'hobby'],
                'voice_config' => ['voice' => 'Cherry', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Today's topic is greetings and self-introduction.
Start by greeting the child warmly, then ask ONE simple question, e.g. their name.
Speak VERY slowly and clearly, like talking to a young child learning English. Pause briefly between sentences.
Each reply is at most TWO or THREE short sentences. Ask only ONE question per reply.
PROMPT,
            ],
            [
                'name' => '餐厅点餐',
                'slug' => 'restaurant',
                    'emoji' => '🍔',
                    'color' => 'coral',
                'level' => 2,
                'description' => '练习在餐厅点餐：菜单、数量、价格',
                'target_vocab' => ['menu', 'pizza', 'hamburger', 'noodles', 'juice', 'milk', 'water', 'ice cream', 'please', 'thank you', 'how much'],
                'voice_config' => ['voice' => 'Cherry', 'pace' => 'normal'],
                'system_prompt' => <<<'PROMPT'
You are a friendly waiter in a restaurant, and {nickname} ({grade}) is your customer. Practice ordering food and drinks.
Welcome the customer with one short sentence, then ask ONE question at a time (e.g. "What would you like to eat?").
Speak VERY slowly and clearly, like talking to a young child learning English. Pause briefly between sentences.
Each reply is at most TWO or THREE short sentences. Ask only ONE question per reply.
PROMPT,
            ],
            [
                'name' => '动物园',
                'slug' => 'zoo',
                    'emoji' => '🐼',
                    'color' => 'mint',
                'level' => 1,
                'description' => '认识动物：老虎、大象、熊猫、猴子',
                'target_vocab' => ['tiger', 'elephant', 'panda', 'monkey', 'giraffe', 'penguin', 'big', 'small', 'cute', 'fast'],
                'voice_config' => ['voice' => 'Cherry', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a kind guide at the zoo, and {nickname} ({grade}) is visiting with you.
Talk about animals: tiger, elephant, panda, monkey, giraffe, penguin.
Ask ONE question at a time, e.g. "What is your favorite animal?"
Speak VERY slowly and clearly, like talking to a young child learning English. Pause briefly between sentences.
Each reply is at most TWO or THREE short sentences. Ask only ONE question per reply.
PROMPT,
            ],
            [
                'name' => '校园生活',
                'slug' => 'school-life',
                    'emoji' => '🎒',
                    'color' => 'azure',
                'level' => 2,
                'description' => '聊聊学校：课程、朋友、课间活动',
                'target_vocab' => ['school', 'class', 'English', 'math', 'art', 'PE', 'music', 'friend', 'teacher', 'playground'],
                'voice_config' => ['voice' => 'Cherry', 'pace' => 'normal'],
                'system_prompt' => <<<'PROMPT'
You are {nickname}'s friendly classmate at school ({grade}). Talk about school life.
Ask ONE question at a time, e.g. "What is your favorite subject?"
Speak VERY slowly and clearly, like talking to a young child learning English. Pause briefly between sentences.
Each reply is at most TWO or THREE short sentences. Ask only ONE question per reply.
PROMPT,
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            Scenario::updateOrCreate(
                ['slug' => $scenario['slug']],
                $scenario + ['sort_order' => $index + 1, 'is_active' => true],
            );
        }

        // 沪教版二上 Unit 1-6 课本单元卡片（对话严格限定在单元词汇/句型/故事/扩展范围内）
        $unitScenarios = [
            [
                'name' => 'U1 五感魔法秀',
                'slug' => 'unit-1-five-senses',
                    'emoji' => '🪄',
                    'color' => 'grape',
                'level' => 1,
                'description' => 'What can you do with your five senses? 用 feel/see/smell/hear/taste 玩猜谜',
                'unit_text' => <<<'TEXT'
【单词】feel 感觉 · see 看见 · smell 闻 · hear 听 · taste 尝 · kitten 小猫 · puppy 小狗 · rabbit 兔子 · flowers 花 · egg 蛋 · ball 球 · bird 鸟 · hard 硬的 · soft 软的
【句型】What can you ...? 你能……吗？ · I can ... 我能…… · It's / They're ... 它（们）是……
【故事 Daisy's magic show 魔术表演】
What can you see? 你能看到什么？
Listen! I can hear a kitten. Miaow! 听！我听到小猫叫。
I can smell flowers. 我闻到花香。
Feel this. It's hard. Is it a ball? No. 摸摸这个，是硬的。是球吗？不是。
Is it an egg? Right! 是鸡蛋吗？对！
Wow! It's a big bird! 哇！是只大鸟！
【扩展 The blind men and the elephant 盲人摸象】hard 硬 / soft 软 / thin 薄 / thick 厚
TEXT,
                'target_vocab' => ['feel', 'see', 'smell', 'hear', 'taste', 'kitten', 'puppy', 'rabbit', 'flowers', 'egg', 'ball', 'bird', 'hard', 'soft'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 1 "What can you do with your five senses?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: feel, see, smell, hear, taste, hands, fingers, eyes, ears, nose, tongue, cat, kitten, puppy, rabbit, flowers, egg, ball, bird, hard, soft, big, cute. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "What can you ...?", "I can ...", "It's / They're ...", "Listen!", "Is it ...?", "Yes / No.", "You're right."

Scenario: You are the magician in Daisy's magic show. Greet the child, then play a guessing game based on the story: ask "What can you see?" and "What can you hear?", accept answers like "I can hear a kitten." Then have the child feel hidden things ("Feel this. It's hard. Is it a ball?") and guess ("Is it an egg? Right!"). Finally ask about the park: "What can you see in the park?" Keep the game at the child's pace.
PROMPT,
            ],
            [
                'name' => 'U2 家庭聚会',
                'slug' => 'unit-2-family',
                    'emoji' => '👨‍👩‍👧',
                    'color' => 'sun',
                'level' => 1,
                'description' => 'What do you like about your family? 认识 uncle/aunt/cousin，用 This is / Who is 介绍家人',
                'unit_text' => <<<'TEXT'
【单词】uncle 叔叔/舅舅 · aunt 阿姨/姑姑 · cousin 堂/表兄弟姐妹 · old 年长的 · young 年轻的 · cute 可爱的 · grandma 奶奶 · grandpa 爷爷 · mum 妈妈 · dad 爸爸 · sister 姐妹 · brother 兄弟 · tall 高的 · short 矮的 · pretty 漂亮的 · handsome 英俊的
【句型】This is ... 这是…… · Who is he / she? 他/她是谁？ · He's / She's ... 他/她是…… · Is he / she your ...? 他/她是你……吗？ Yes / No.
【故事 Dan's story: At Uncle Bob's party 鲍勃叔叔的聚会】
Who is he? He's my cousin, Henry. 他是谁？他是我表哥亨利。
Is she your sister? No. She's Henry's sister, Ann. 她是你妹妹吗？不是，她是亨利的妹妹安。
Say cheese! 说"茄子"！（拍照）
Hi, children! Aunt Susan! You look great. 嗨，孩子们！苏珊阿姨！你真漂亮。
Where's Uncle Bob, Henry? Let's look for him! 亨利，鲍勃叔叔在哪？我们去找他吧！
【扩展 Grandma's bag 奶奶的包】Ken the dog is naughty. 小狗肯很淘气。
TEXT,
                'target_vocab' => ['uncle', 'aunt', 'cousin', 'old', 'young', 'cute', 'grandma', 'grandpa', 'mum', 'dad', 'sister', 'brother', 'tall', 'short', 'small', 'pretty', 'handsome', 'party'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 2 "What do you like about your family?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: uncle, aunt, cousin, old, young, cute, grandma, grandpa, mum, dad, sister, brother, tall, short, small, pretty, handsome, party, happy. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "This is ...", "Who is he / she?", "He's / She's ...", "Is he / she your ...?", "Yes / No.", "Say cheese!", "Let's ..."

Scenario: You are at Uncle Bob's party (Dan's story). Take family photos: say "Say cheese!", then point at family members and ask "Who is he?" or "Is she your sister?"; the child answers with "He's my cousin, Henry." or "No. She's Henry's sister, Ann." Then ask about the child's own family: "Who is your uncle?" and "What do you like about your family?" Use one story scene per turn.
PROMPT,
            ],
            [
                'name' => 'U3 寻找玩具',
                'slug' => 'unit-3-toys',
                    'emoji' => '🧸',
                    'color' => 'coral',
                'level' => 2,
                'description' => "What is your favourite toy? 用 It has ... 描述玩具特征，帮 Bill 找玩具",
                'unit_text' => <<<'TEXT'
【单词】doll 娃娃 · toy plane 玩具飞机 · toy bear 玩具熊 · ball 球 · robot 机器人 · jigsaw puzzle 拼图 · teddy 泰迪熊 · toy car 玩具车 · kite 风筝 · blue 蓝色的 · ears 耳朵 · eyes 眼睛 · spider 蜘蛛 · lost 丢失的 · find 找到
【句型】This is / These are ... 这是/这些是…… · It's / They're ... 它（们）是…… · It has ... 它有…… · I have ... 我有…… · What colour is ...? ……是什么颜色？
【故事 Bill's story: The lost toy 丢失的玩具】
I can't find my toy. It's blue. It has no ears. 我找不到我的玩具了。它是蓝色的，没有耳朵。
It has two eyes. 它有两只眼睛。
It has two ears! Not that toy. 它有两只耳朵！不是那个玩具。
It has three eyes! 它有三只眼睛！
Oh! It's a spider! 哦！是只蜘蛛！
Here's your toy, Bill. Thank you! 比尔，你的玩具在这。谢谢！
【扩展 Different toys 不同的玩具】I can fly my kite in the park. 我可以在公园放风筝。
TEXT,
                'target_vocab' => ['doll', 'toy plane', 'toy bear', 'ball', 'robot', 'jigsaw puzzle', 'teddy', 'toy car', 'kite', 'blue', 'ears', 'eyes', 'spider', 'lost', 'find', 'colour'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 3 "What is your favourite toy?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: doll, toy plane, toy bear, ball, robot, jigsaw puzzle, teddy, toy car, kite, blue, ears, eyes, spider, lost, find, colour. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "This is / These are ...", "It's / They're ...", "It has ...", "I have ...", "What colour is ...?", "I can't find my ...", "Not that toy.", "Here's your toy."

Scenario: Play Bill's lost-toy story: the child helps find Bill's toy by describing what they see ("Look! A blue toy." "It has two ears." → "Not that toy.") until the spider with three eyes is found ("Look! This is Bill's toy!" "Thank you!"). Then ask the child about their own favourite toy: "What is your favourite toy?" and "What does it look like?" (answer with "My favourite toy is ... It has ..."). Extension: "What toy do you like? What can you do with it?" (e.g. fly a kite in the park).
PROMPT,
            ],
            [
                'name' => 'U4 我家附近',
                'slug' => 'unit-4-around-home',
                    'emoji' => '🏪',
                    'color' => 'azure',
                'level' => 2,
                'description' => 'What is around your home? 逛 pet shop / fruit shop / cinema / zoo / park',
                'unit_text' => <<<'TEXT'
【单词】pet shop 宠物店 · fruit shop 水果店 · cinema 电影院 · zoo 动物园 · park 公园 · toy shop 玩具店 · shopping centre 购物中心 · home 家 · street 街道 · apples 苹果 · doll 娃娃 · beautiful 漂亮的 · nice 好的 · soft 柔软的
【句型】What's around your home? 你家附近有什么？ · This is / That's a ... 这是/那是…… · We can ... 我们可以…… · Let's ... 让我们……
【故事 Nana's story: Around my new home 我的新家附近】
We're near our new home. 我们快到新家了。
Look! A zoo! 看！动物园！
That's a fruit shop! Let's buy some apples. 那是水果店！我们买些苹果吧。
That's a cinema. 那是电影院。
That's a big shopping centre! 那是个大购物中心！
Here's a toy shop! I want a new doll. 这儿有玩具店！我想要个新娃娃。
【扩展 My favourite shopping centre 我喜欢的购物中心】flower shop 花店 · restaurant 餐厅
TEXT,
                'target_vocab' => ['pet shop', 'fruit shop', 'cinema', 'zoo', 'park', 'toy shop', 'shopping centre', 'home', 'street', 'apples', 'doll', 'beautiful', 'nice', 'soft'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 4 "What is around your home?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: pet shop, fruit shop, cinema, zoo, park, toy shop, shopping centre, home, street, apples, doll, beautiful, nice, soft. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "What's around your home?", "This is / That's a ...", "We can ...", "Let's ...", "Look! A ...", "I want a ..."

Scenario: Take a walk with Nana near her new home (Nana's story). Move one place per turn: see the zoo ("Look! A zoo!"), buy apples at the fruit shop ("Let's buy some apples."), pass the cinema, see the big shopping centre, and stop at the toy shop ("I want a new doll."). Then ask the child: "What's around your home?" and "What can we do there?" (answer: "We can buy apples at the fruit shop.")
PROMPT,
            ],
            [
                'name' => 'U5 农场之旅',
                'slug' => 'unit-5-farm',
                    'emoji' => '🐮',
                    'color' => 'mint',
                'level' => 3,
                'description' => 'What do you like about farms? 认识 cow/sheep/duck/pig，找黑白动物',
                'unit_text' => <<<'TEXT'
【单词】cow 奶牛 · sheep 绵羊 · duck 鸭子 · chick 小鸡 · chicken 鸡 · pig 猪 · donkey 驴 · goat 山羊 · puppy 小狗 · butterfly 蝴蝶 · horse 马 · farm 农场 · black 黑色 · white 白色 · brown 棕色 · grey 灰色 · red 红色 · cute 可爱的 · water 水
【句型】What animals can you see? 你能看到什么动物？ · These / Those are ... 这些/那些是…… · They're ... 它们是…… · I like ... 我喜欢…… · Look at ... 看…… · Don't touch it. 别碰它。
【故事 Penny's story: On the farm 在农场】
Let's find black and white animals. 我们来找黑白相间的动物吧。
Look at the butterfly. Don't touch it. 看那只蝴蝶。别碰它。
Here are some chickens. They're red and brown. 这里有些鸡。它们是红色和棕色的。
Here's a puppy. It's brown. It's cute. 这儿有只小狗。它是棕色的，很可爱。
These are white goats. 这些是白色的山羊。
Look! Cows! They're black and white! 看！奶牛！它们是黑白相间的！
【扩展 Old MacDonald has a farm】quack 嘎嘎(鸭) · moo 哞(牛) · baa 咩(羊) · neigh 嘶(马) · oink 哼哼(猪)
TEXT,
                'target_vocab' => ['cow', 'sheep', 'duck', 'chick', 'chicken', 'pig', 'donkey', 'goat', 'puppy', 'butterfly', 'horse', 'farm', 'black', 'white', 'brown', 'grey', 'red', 'cute', 'water'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 5 "What do you like about farms?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: cow, sheep, duck, chick, chicken, pig, donkey, goat, puppy, butterfly, horse, farm, black, white, brown, grey, red, cute, water. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "What animals can you see?", "These / Those are ...", "They're ...", "I like ...", "Look at ...", "Don't touch it.", "Here's / Here are ...", "Let's ..."

Scenario: Visit Penny's farm (Penny's story). Walk the farm step by step: "Let's find black and white animals." Show the butterfly ("Look at the butterfly." "Don't touch it."), the red and brown chickens, the cute brown puppy (give it water), the white goats, and the black and white cows. Then play Old MacDonald: ask "What animals can you see on a farm?" and make animal sounds together (cow-moo, duck-quack, sheep-baa, horse-neigh, pig-oink). Ask which animal the child likes and why.
PROMPT,
            ],
            [
                'name' => 'U6 中秋节',
                'slug' => 'unit-6-mid-autumn',
                    'emoji' => '🌕',
                    'color' => 'grape',
                'level' => 3,
                'description' => 'How do people celebrate the Mid-Autumn Festival? 玩灯笼、吃月饼、赏月、猜灯谜',
                'unit_text' => <<<'TEXT'
【单词】play with lanterns 玩灯笼 · eat mooncakes 吃月饼 · solve riddles 猜谜语 · look at the moon 赏月 · full moon 满月 · bright 明亮的 · traditional 传统的 · festival 节日 · family 家人 · dinner 晚餐 · together 一起 · rabbit 兔子 · night 夜晚
【句型】We / I ... at the Mid-Autumn Festival. 中秋节我们/我…… · This is my mooncake. There's a ... on it. 这是我的月饼，上面有…… · Can you see ...? 你能看到……吗？
【故事 The Mid-Autumn Festival 中秋节】
The Mid-Autumn Festival is a traditional Chinese festival. 中秋节是中国的传统节日。
We play with lanterns. 我们玩灯笼。
Families have a big dinner together. 家人一起吃团圆饭。
We eat mooncakes too. They taste good. 我们还吃月饼，味道很好。
At night, we look at the moon. It is big and bright. 晚上我们赏月，月亮又大又亮。
【扩展 The story of Chang'e 嫦娥的故事】Chang'e flies to the moon. 嫦娥飞到了月亮上。Can you see Chang'e? 你能看到嫦娥吗？
TEXT,
                'target_vocab' => ['play with lanterns', 'eat mooncakes', 'solve riddles', 'look at the moon', 'full moon', 'bright', 'traditional', 'festival', 'family', 'dinner', 'together', 'rabbit', 'night'],
                'voice_config' => ['voice' => 'Serena', 'pace' => 'slow'],
                'system_prompt' => <<<'PROMPT'
You are a friendly English tutor talking with {nickname}, {grade}. Topic: Unit 6 "How do people celebrate the Mid-Autumn Festival?" (Shanghai Education Press, Grade 2).

STRICT WORD LIMIT: use ONLY these words: play with lanterns, eat mooncakes, solve riddles, look at the moon, full moon, bright, traditional, festival, family, dinner, together, rabbit, night. Do not use any other vocabulary.

STRICT SENTENCE PATTERNS: only "We / I ... at the Mid-Autumn Festival.", "This is my mooncake. There's a ... on it.", "Can you see ...?", "What do you do with your parents at the Mid-Autumn Festival?", "It is ..."

Scenario: Talk about the Mid-Autumn Festival (the unit story): it is a traditional Chinese festival; families have a big dinner together, play with lanterns, eat mooncakes ("They taste good."), and at night look at the big bright full moon. Tell the moon riddle ("Sometimes it's a 'C'. Sometimes it's an 'O'. What is it?") and let the child guess "the moon". Talk about mooncakes: "This is my mooncake. There's a rabbit on it." Ask the child: "What do you do with your parents at the Mid-Autumn Festival?" Finally mention the story of Chang'e: "Can you see Chang'e on the moon?"
PROMPT,
            ],
        ];

        foreach ($unitScenarios as $index => $scenario) {
            Scenario::updateOrCreate(
                ['slug' => $scenario['slug']],
                $scenario + ['sort_order' => 10 + $index + 1, 'is_active' => true],
            );
        }

        // 旧的通用占位卡片下架（管理端可随时重新上架）
        Scenario::query()
            ->whereIn('slug', ['greetings', 'restaurant', 'zoo', 'school-life'])
            ->update(['is_active' => false]);
    }
}

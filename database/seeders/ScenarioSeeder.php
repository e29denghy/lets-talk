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
                'level' => 1,
                'description' => 'What can you do with your five senses? 用 feel/see/smell/hear/taste 玩猜谜',
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
                'level' => 1,
                'description' => 'What do you like about your family? 认识 uncle/aunt/cousin，用 This is / Who is 介绍家人',
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
                'level' => 2,
                'description' => "What is your favourite toy? 用 It has ... 描述玩具特征，帮 Bill 找玩具",
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
                'level' => 2,
                'description' => 'What is around your home? 逛 pet shop / fruit shop / cinema / zoo / park',
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
                'level' => 3,
                'description' => 'What do you like about farms? 认识 cow/sheep/duck/pig，找黑白动物',
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
                'level' => 3,
                'description' => 'How do people celebrate the Mid-Autumn Festival? 玩灯笼、吃月饼、赏月、猜灯谜',
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

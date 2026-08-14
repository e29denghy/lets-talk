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
Start by greeting the child warmly and ask their name, how they are, and their age.
Then ask about their favorite color or hobby. Respond naturally with short, simple sentences.
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
Welcome the customer, read a simple menu (pizza, hamburger, noodles, rice, juice, milk, water, ice cream).
Take the order step by step, ask about preferences, then confirm the order and tell a simple total price.
Use short sentences and simple numbers.
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
Ask which animal the child likes. Describe animals with simple words: big, small, tall, cute, fast.
Encourage the child to say the animal names out loud.
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
Ask about the child's favorite subject (English, math, art, PE, music), their friends, and what they do during recess.
Share simple stories about your own school day too, and ask follow-up questions.
PROMPT,
            ],
        ];

        foreach ($scenarios as $index => $scenario) {
            Scenario::updateOrCreate(
                ['slug' => $scenario['slug']],
                $scenario + ['sort_order' => $index + 1, 'is_active' => true],
            );
        }
    }
}

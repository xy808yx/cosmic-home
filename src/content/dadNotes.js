// ============================================================================
// Dad's Notes — ONE list, rotating across every secret room
// ============================================================================
//
// This is the whole thing. There is no per-room deck: every notice board in
// every secret room deals off this single list.
//   • the garage whiteboard   (Dad's Garage, W16)
//   • the playground board    (Playground, W18)
//   • the hot pot table board (Hot Pot Time, W19)
//
// Each morning the deck deals three DIFFERENT notes and pins one to each board
// for the day, so visiting all three rooms gives three new notes rather than the
// same line three times. Each board pays its own +10 stardust once a day, the
// first time its note is opened (30/day for all three). See
// PlayerProgress.getDailyNoteForBoard and claimDailyNoteReward.
//
// Every note is shown once before any repeat, in random order, reshuffling each
// cycle. At three a day that's about eight weeks of notes before anything comes
// back around. Add a line anywhere below and it joins the rotation immediately:
// the deck reshuffles automatically when the list length changes.
//
// The section headings are for reading and editing convenience ONLY. They have
// no effect on the game: notes are dealt from the whole list, not by section, so
// a note filed under "Your body" can just as easily land on the hot pot board.
//
// One constraint worth knowing: the GARAGE whiteboard letters its note directly
// onto a fixed 424x104 panel (the other two boards say "tap to read" and show
// the note in a popup). HiddenWorldScene shrinks the type to fit and, past the
// smallest size, trims with an ellipsis. Everything currently here fits: the
// longest note is 153 characters. Keep new notes at or under roughly 250 and
// nothing gets cut off.
//
// Nothing in this list is signed. These are all meant to be from Dad, including
// the ones that are rewrites of famous lines, so a sign-off on two of them made
// those two look like the only real ones. Don't add one back.

export const DAD_NOTES = [
  // ------------------------------------------------------------------
  // God
  // ------------------------------------------------------------------
  "God gave you your own gifts. Don't waste time wishing for someone else's.",
  "God doesn't ask you to win. He asks you to try.",
  "There's a room in your heart that only God belongs in. Don't fill it up with stuff.",
  "Next to what God wants, everything else gets smaller.",
  "God called Samuel, and Samuel said, \"Here I am.\" That's the whole answer. Be ready to say it.",
  "It's never luck. It's always God.",
  "A little bit of thinking can take you away from God. A lot of thinking brings you back.",
  "Before you set out on anything big, ask God's blessing on it.",
  "What good is it to win the whole world if you lose yourself?",
  "Put first things first and you get the second things thrown in. Put second things first and you lose both.",
  "If you wait for perfect weather, you'll never plant anything.",
  "Don't keep everything you have in one basket. You never know which way trouble is coming from.",
  "We walk through time one day at a time, and only forwards. God sees the whole thing at once.",

  // ------------------------------------------------------------------
  // Starting, and not quitting
  // ------------------------------------------------------------------
  "Being brave doesn't mean you're not scared. It means you're scared and you do it anyway.",
  "Don't rush. Slow and steady beats standing still every single time.",
  "The best time to start something? Right now. Let's go.",
  "Hard things feel impossible right before they click. Don't quit early.",
  "Nobody gets good at anything without practicing when it's boring. Nobody.",
  "The biggest adventures start with one small brave step.",
  "Try lots of things while you're young. You'll find what fits.",
  "The best things grow slowly. Plant the seed, water it a little every day, and don't dig it up to check. Give it time.",
  "Don't be afraid of being slow. Be afraid of standing still.",
  "The best time to plant a tree was twenty years ago. The second best time is today.",
  "Next year you'll wish you had started today.",
  "How you spend your days is how you spend your life. Today counts.",
  "Sometimes you win. Sometimes you learn.",
  "Being good at something is not something you get to keep. You earn it again every day.",
  "One day you will look back, and the hardest parts will be the ones you are proudest of.",
  "No plan survives the first minute. Make one anyway, then change it.",
  "If you only plan for things going well, a mess will knock you over. Plan for the mess and you are fine either way.",
  "Life keeps teaching you the same lesson until you finally learn it.",
  "Failing teaches you things winning never will. Don't dodge it completely.",
  "Things take way longer to happen than you think. Then they happen all at once.",
  "The first one to try something takes all the bumps. The second one gets the easy road. Go first anyway sometimes.",
  "It is much easier to grow up strong than to fix yourself later. Doing it now is the easy way.",

  // ------------------------------------------------------------------
  // Your body
  // ------------------------------------------------------------------
  "Eat good food, move your body, read books. Everything else is bonus.",
  "You only get one body. You can't swap it for a new one, so take care of it. It has to last your whole life.",
  "Your body goes everywhere you go, and nobody can take it from you. So make it strong.",
  "Being strong and fast isn't a prize you win once. It's just part of taking good care of yourself, every day.",
  "Train your body and your brain. A strong person who can't think is only half a person. So is a smart person who's weak. Work on both.",
  "Doing something well beats doing it a lot. One great try is worth more than a hundred lazy ones.",
  "Most of the time you save some energy. Once in a while something matters so much you use every bit. Learn to tell which is which.",
  "Doing the work even when you don't feel like it is the hardest part. Most people give up right there. You don't have to.",
  "You don't have to do a hundred things. Pick the few that really matter, and do those really well.",
  "Rest is part of getting stronger, not the opposite. Your body gets stronger while you rest, not while you're tired out.",
  "Don't just trust how you feel. Trust what you can check and measure. Your body will say it's ready before it really is.",
  "You earn the next step. You don't get to skip ahead just because you want it now.",
  "Some pain means you're getting stronger. Some pain is a warning that something is wrong. Learn to tell them apart.",
  "When you get hurt or knocked down, don't just try to get back to where you were. Try to come back even stronger.",
  "Hard things help you grow, but only the right amount. Too little does nothing. Too much breaks you. The trick is finding the right amount.",
  "A lot of the time, the answer isn't doing more. It's stopping the thing that's hurting you.",
  "Win or lose, you're still you. A trophy can't make you better, and losing one can't make you worse. You're the same person either way.",
  "Learn to love the work, not just the winning. You get to do the work every day. Winning doesn't come every day.",
  "Be the boss of your own body. Listen to good coaches, but don't let anyone else make all your choices for you.",
  "How you do one thing is how you do everything. The way you train shows up in the way you live.",
  "The best kind of person trains their mind and their body. Strong enough to fight, smart enough not to have to.",
  "Try lots of sports while you're young. Most of the greatest athletes played all kinds of things before they picked one.",
  "The cure for anything is salt water: sweat, tears, or the sea.",
  "Nothing you buy will make you better. Everything you need to grow with is already inside you.",
  "Learn the rules really, really well. Then you'll know when to break them. Bruce Lee did both.",
  "Keep your plans quiet. Then when you move, move like thunder.",
  "If you want peace, be ready. Nobody picks on the prepared.",
  "Every so often, go without something you like on purpose. It makes you very hard to push around.",
  "Eat well, move your body, spend less than you make. Boring rules. Those three are what buy you a free life.",

  // ------------------------------------------------------------------
  // Thinking and learning
  // ------------------------------------------------------------------
  "Smart people ask great questions. Keep asking why.",
  "You're going to mess up sometimes. That's not losing, that's learning.",
  "Your brain is like a muscle. Every hard thing you do makes it stronger.",
  "Every single person you meet knows something you don't. Pay attention.",
  "It's okay to not know the answer. Say 'I don't know' and then go find out.",
  "Dad doesn't have all the answers either. I just never stop looking.",
  "Be curious about everything. Bored people aren't paying attention.",
  "Always ask, \"Why?\" and \"How do we know that?\" Don't believe something just because someone said it loudly or sounded sure.",
  "Saying \"I don't know\" feels bad for a second. Understanding something feels good forever. Pick understanding over being right.",
  "You don't really understand something until you can argue the other side better than they can.",
  "Not knowing feels uncomfortable. Being totally sure about everything is worse.",
  "Judge a person by their questions, not their answers.",
  "If you think you have all the answers, you didn't understand the questions.",
  "You have to learn an awful lot before you find out how little you know.",
  "The farther you travel, the less you realize you know.",
  "More mistakes come from being stubborn than from being confused.",
  "To get smarter, add something every day. To get wiser, take something away every day.",
  "A full cup can't hold any more tea. Come to new things with an empty cup.",
  "Everyone wants a better memory. Almost nobody practices letting things go.",
  "You mostly see what you were already looking for. So look for good things.",
  "Learning something new always stings your pride a little. That's why little kids learn fast and proud grown-ups don't learn at all.",
  "A map is not the place. Go and see it yourself.",
  "Every time you practise, your brain builds a path for it. Stop using a path and your brain quietly takes it apart. Use it or lose it.",
  "People who speak different languages notice different things. Learning another language hands you a second way of thinking.",
  "Some questions answer themselves the moment you actually say them out loud.",
  "There are lots of ways to win and only a few ways to lose. Learn how not to lose first.",

  // ------------------------------------------------------------------
  // Being a person worth being
  // ------------------------------------------------------------------
  "You don't have to be better than anyone else. Just be better than yesterday-you.",
  "Be the kid who's strong AND kind. The world needs both.",
  "Rules aren't the opposite of freedom. They're how you earn it.",
  "Standing up for what's right is hard. Do it anyway.",
  "Tell the truth, even when it gets you in trouble. A lie starts small but keeps growing. The truth is easier in the end, even when it's hard right now.",
  "Keep your word. If you said you'd do something, do it. Do it even when it's hard, and even when no one is watching.",
  "Some mistakes you can fix. A few you can never undo. Be brave with the ones you can fix, and very careful with the ones you can't.",
  "Don't do something just because everyone else is. The crowd is often wrong. Think for yourself, and be willing to go your own way.",
  "Learn to do real things. Learn to fix, build, carry, and help. A person who can do things is never helpless.",
  "Beating your own best is the best win there is.",
  "There's nothing great about being better than somebody else. Being better than who you were is the real thing.",
  "Don't try to be successful. Try to be worth something.",
  "Everybody has it in them to be really good or really bad. You pick, every day.",
  "Be true to yourself. Always.",
  "Rule your mind or it will rule you.",
  "It's only embarrassing if you're embarrassed.",
  "The two most important days of your life are the day you were born and the day you find out why.",
  "Don't do something just to look important, or to be liked, or for money alone.",
  "The people who most want to be in charge are usually the ones who should not be.",
  "Some things break when you shake them. A few things actually get stronger. Be the second kind.",
  "Getting a lot done and being a good person are two different scores. Win the one that counts.",

  // ------------------------------------------------------------------
  // Worry, and what's yours to carry
  // ------------------------------------------------------------------
  "When you're frustrated, take a breath. Then try one more time.",
  "Some days are tough. That's okay. Tomorrow you get to try again.",
  "You can't always control what happens. You can only control what you do next. When something goes wrong, don't stay angry. Ask, \"Okay, what do I do now?\"",
  "Don't let the future bother you. When it shows up, you'll meet it with the same good sense you have today.",
  "Don't let someone who upset you keep taking up room in your head.",
  "When things go wrong it is easy to blame everyone else. Growing up means looking at yourself first. Being wise means you don't need to blame anyone.",
  "Not every problem needs a clever answer. Sometimes the simple one is right.",
  "Not knowing what happens next is exactly what makes you free.",

  // ------------------------------------------------------------------
  // People
  // ------------------------------------------------------------------
  "People forget what you said. They remember how you made them feel. Be warm.",
  "If someone's having a hard day, just be nice to them. That's enough.",
  "A good friend is worth more than a hundred toys. Choose your people wisely.",
  "Listen more than you talk. Still waters run deep.",
  "I'm proud of you. Not for being perfect. For being you.",
  "Be kind to people who can't give you anything back. The way you treat someone smaller or weaker shows who you really are.",
  "Be hard on the problem and soft on the person.",
  "If you want to go fast, go alone. If you want to go far, go together.",
  "Even if you grow apart from someone, you still grew up side by side. Your roots stay tangled forever.",
  "Say what you think once, clearly. If they still don't agree, drop it. Saying it again won't help.",
  "Make deals that are fair to both sides. A deal that is good for only one of you falls apart.",
  "Don't take everything an older person tells you. Fools grow old too.",
  "Grown-ups use big words for their work. Sometimes it is on purpose, to keep you out. Ask them to say it in plain words.",
  "Some work you do because you love it, not for the money. Pick that kind when you can.",
  "Being free is not just nobody bossing you. It is not needing to boss anybody either.",
  "People will forget what you said and they'll forget what you did. They will never forget how you made them feel.",
  "Everybody is put together differently. Working out how somebody works is most of getting along with them.",
  "Pick your friends on purpose, not just because they happened to be sitting next to you.",
  "Don't spend your life checking where you come in the line. That game never ends.",

  // ------------------------------------------------------------------
  // Money and stuff
  // ------------------------------------------------------------------
  "You don't need a lot of stuff to be happy. You need people and adventures.",
  "Find out how little you actually need to be happy. Knowing that number makes you free.",
  "Happiness isn't getting more. It's learning to enjoy less.",
  "Price is what you pay. Value is what you actually get. A cheap thing that breaks costs you more.",
  "Money should work for you. Don't spend your life working for it.",
  "People chase money and stuff their whole lives. Nothing beats not having to worry.",
  "Everybody who ever lived was busy with something. Where are they all now? Don't spend your life chasing things that won't matter.",
  "Ads and apps are built to make you want things. Notice when somebody is selling to you.",
  "Ask what something costs in time, not just in money. Time is the one you can't earn back.",
  "Never put everything into one thing. Split it up. You don't get to know ahead of time which one works out.",
  "Save enough that you can say no thank you to things you don't want to do. That is what money is really for.",
  "A wolf is a dog that never took the free food. Easy things can cost you more than they look.",

  // ------------------------------------------------------------------
  // Going places
  // ------------------------------------------------------------------
  "Read ten thousand books. Walk ten thousand miles. You need both.",
  "Travel changes the way you feel about the whole planet.",
  "A line on a map does not decide who you are.",
  "The words you know are the size of your world. Go learn more words.",

  // ------------------------------------------------------------------
  // Time and attention
  // ------------------------------------------------------------------
  "Don't just watch the game. Get in there and play it.",
  "Being busy is not the same as being alive. Make time to just be here.",
  "Stop planning and worrying for one minute and look around. That minute is your life too.",
  "When it is time to work, work. When it is time to play, play. Don't mix them up.",
  "A good teacher is worth more than anything you can buy.",
  "Stories let you make the mistake and learn the lesson without getting hurt. That's what books are for.",
  "Four things never come back: the word you said, the arrow you shot, the day that passed, and the chance you didn't take.",
  "Some things you can measure don't matter. Some things that matter you can't measure.",
  "Be careful what you wish for. Chasing it will change who you are.",
  "When you're doing something that matters, it's okay to tell people to wait.",
  "Some things you learn from your parents on purpose. Some you pick up by accident. Both of them count.",
];

// The notice boards that deal off the list above. They share the list and the
// deck; each keeps its own once-per-day stardust claim. Must match
// GameData.DAD_NOTE_BOARDS.
export const NOTE_BOARDS = ['garage', 'playground', 'hotpot'];

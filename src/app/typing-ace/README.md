# Typing Ace

Typing Ace is a smart AI-powered typing tutor. It's goal is to help you identify your weakest typing areas and give you exercises to improve them. 



## Use Cases

### Identify typing weakness


#### Example User Journey

User types the domain name in their browser and comes to the home page. They click "Discover my typing weakness". They are then presented with an overview of the typing test they are about to take. They take a typing test. They are shown their WPM, adjusted WPM (factors errors) number of errors, and a list of their weakest two and three button combinations, for example:

Your Weakest Key Combinations

3 Characters
"S", "q", "u": 123ms (typed 2 times)
"a", " ", "m": 83ms (typed 4 times)
[etc..]

2 Characters
"S", "q": 60ms (typed 2 times)
"b", "r": 30ms (typed 41 times)
[etc...]

Most Fumbled Characters
"f": caused an error in a word 12 times
"l": cased an error in word 10 times
(we stop counting errors in a word after the first incorrect letter)

Weakest characters
"." : appeared in 5 of your top 20 weakest 2 and 3 character combinations 
"s" : appeared in 3 of your top 20 weakest 2 and 3 character combinations

*The players lifetime metrics are updated with the data from their test. 

After viewing the report, the user clicks "Practice these weaknesses". They are then presented with a list of options to include in the practice, for example:

[] Weakest 3 character combinations
[] Weakest 2 character combinations
[] Weakest characters
[] Most fumbled characters

The AI then creates as new typing exercise for them based on their selection. They can continue taking tests and repeating the process. 

*These are tracked as well, but exercises and tests can be visualized differently in the app


### Generate a typing exercise

#### Example User Journey

The user comes to the home page of the site and clicks "Get a personalized typing test"

The user is then presented with options to use to generate their typing test. There is a list of options to select from their profile, like "Weakest 3 character combinations", "Most errored words", etc. But none of them are selectable. There's some text that says "take an evaluation test or do some exercises to start using personal metrics".

The user types in a field labled "ask AI to maek a test for you", "Create a test that helps me work on the shift key with my right hand" and clicks "start chat"

A loading chat bubble appears above the input, turning the component into a mini-chat. They then see a response message "Just to confirm, I'll create an exercise that will help you practice your right hand shift key by using words that have capitalized left-hand letters, like "A", "Z", "#", "F", and others. Does that sound good? 

The see two buttons appear, "Yes" and "Something Else"

They click "Something Else", the buttons disappear and a message appears saying "Okay, tell me what to change". Meanwhile the input becomes focused and enabled. They type "lets avoid special characters in this exercise". They see a response message that describes the app's understanding of the request, repeating the process until the user confirms the selection. 

The app indicates its loading a new typing exercise for them. When its ready the user starts the exericse and completes it. When they are finished they see a visualization/report of their metrics for the exercise. They are shown their WPM, adjusted WPM (factors errors) number of errors, and a list of their weakest two and three button combinations, which are also saved to their lifetime metrics, for example:

Your Weakest Key Combinations

3 Characters
"S", "q", "u": 123ms (typed 2 times)
"a", " ", "m": 83ms (typed 4 times)
[etc..]

2 Characters
"S", "q": 60ms (typed 2 times)
"b", "r": 30ms (typed 41 times)
[etc...]

Most Fumbled Characters
"f": caused an error in a word 12 times
"l": cased an error in word 10 times
(we stop counting errors in a word after the first incorrect letter)

Weakest characters
"." : appeared in 5 of your top 20 weakest 2 and 3 character combinations 
"s" : appeared in 3 of your top 20 weakest 2 and 3 character combinations

*The players lifetime metrics are updated with the data from their test. 

After viewing the report, the user clicks "Practice these weaknesses". They are then presented with a list of options to include in the practice, for example:

[] Weakest 3 character combinations
[] Weakest 2 character combinations
[] Weakest characters
[] Most fumbled characters

The AI then creates as new typing exercise for them based on their selection. They can continue taking tests and repeating the process. 

*These are tracked as well, but exercises and tests can be visualized differently in the app


### View historical data

#### Example User Journey



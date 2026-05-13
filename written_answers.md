# Written answers — Luis Fernando Lopez Espinosa

> ~200 words per question. Past-tense, real systems. See `SUBMISSION.md`.

## Q1 — Production correctness validation

> Describe a system you owned where you had to add production correctness validation — alarms, contract tests, golden datasets, something that caught a class of bugs before users did. What did you do, what worked, what didn't, and what would you do differently?

> --

> Answer: My most recent project was this Crypto/AI Native payments platform, I was the lead engineer responsible for the analysis and definition of the different layers of the solution. I implemented different approaches to make sure the platform was robust, scalable and secure enough to pass security and compliance requirements. At the time we needed the platform to handle a traffic volume of about 1.5k RPS. We had to face many different challenges that we were able to sort out eventually with the correct process and methodologies. Of course there are a lot of things I would do differently now that I have that amazing and successful experience. First of all I would go for a strong process to define the different functional and non-functional requirements starting from the very initial stage of the project (business requirements).



## Q2 — Scaling-forced structural change

> Describe a system you've worked on where scaling — traffic, data volume, team size, or geography — forced a structural change to the code or architecture. What changed, who pushed back, and how did you decide?

> --

> Answer: For the Crypto/AI platform that I mentioned before. I led the launching of a big campaign in collaboration with Binance. We had to pass all their compliance requirements not only in the code side of things but also we had to adapt the product to meet their requirements and suggestions since this our platform had to integrate with their different services and UX. Also we had to support multiple regions specially ASIA so observability and monitoring were crucial aspects of our process. 



## Q3 — Cross-team contract change

> Describe a time you needed another team to change their API, contract, or shared resource for your work to ship. How did you propose it, how did the other side respond, and how did the change actually land?

> --

> Answer: Yes I have been there quite often!. For the same project I mentioned before I had to handle integrations with 3rd party providers all the time, collaborating with the different engineering teams is a great way to improve not only technical skills but also leadership/ownership skills. One great example is the integration with Binance where we had to implement specific campaign endpoints so Binance services could validate users actions fetching real-time data from our platform. Not to mention we had to support different endpoints versioning and be robust enough to handle their requests volume. In my experience I  would prioritize establishing clear SLAs and versioning strategies early on to minimize friction when contracts need to change.

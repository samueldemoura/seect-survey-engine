import config from 'config';

//
// Fetch some values from the config.
//
const MAX_DELIVERIES_PER_DAY: number = config.get(
  'deliveryThrottling.maxDeliveriesPerDay',
);
const MIN_DELIVERIES_PER_DAY: number = config.get(
  'deliveryThrottling.minDeliveriesPerDay',
);
const WARMUP_DURATION_IN_MINUTES: number = config.get(
  'deliveryThrottling.warmupDurationInMinutes',
);

//
// Do some basic arithmetic.
//
const MAX_DELIVERIES_PER_HOUR = MAX_DELIVERIES_PER_DAY / 24;
const MAX_DELIVERIES_PER_MINUTE = MAX_DELIVERIES_PER_HOUR / 60;
const MAX_DELIVERIES_PER_SECOND = MAX_DELIVERIES_PER_MINUTE / 60;
const SLEEP_SECONDS_FOR_MAX_DELIVERIES = 1 / MAX_DELIVERIES_PER_SECOND;

const MIN_DELIVERIES_PER_HOUR = MIN_DELIVERIES_PER_DAY / 24;
const MIN_DELIVERIES_PER_MINUTE = MIN_DELIVERIES_PER_HOUR / 60;
const MIN_DELIVERIES_PER_SECOND = MIN_DELIVERIES_PER_MINUTE / 60;
const SLEEP_SECONDS_FOR_MIN_DELIVERIES = 1 / MIN_DELIVERIES_PER_SECOND;

// If I can make X deliveries in a minute, and I want to warm up for Y minutes,
// I'll have made X * Y deliveries before I'm at full throttle.
const WARMUP_COUNT = MAX_DELIVERIES_PER_MINUTE * WARMUP_DURATION_IN_MINUTES;

//
// And then this took me longer than I'd like to admit, so process was described
// below for verifying correctness later.
//

/*
Given a linear function:

```f(x) = mx + b```

We'll treat `x` as the count of deliveries already made, and everything else
we will deduce.

We want it to be such that, at the very beginning (so when the delivery counter
is at 0), we go as slow as possible. So:

```f(0) = SLEEP_SECONDS_FOR_MIN_DELIVERIES```

Therefore, `b = SLEEP_SECONDS_FOR_MIN_DELIVERIES`.

We also want it to be such that, after we've made enough deliveries to finish
the warmup period, we want to be going at full speed. So:

```f(WARMUP_COUNT) = SLEEP_SECONDS_FOR_MAX_DELIVERIES```

Which, when applied to the basic equation of a linear function, gives us:

```f(x) = mx + SLEEP_SECONDS_FOR_MIN_DELIVERIES```

Renaming `x` to get closer to what the code would look like, we have:

```f(WARMUP_COUNT) = m * WARMUP_COUNT + SLEEP_SECONDS_FOR_MIN_DELIVERIES```

So, if we keep up the deduction process (cannot recall what this is actually
called at all), we get:

```
m * WARMUP_COUNT + SLEEP_SECONDS_FOR_MIN_DELIVERIES = SLEEP_SECONDS_FOR_MAX_DELIVERIES
m * WARMUP_COUNT = SLEEP_SECONDS_FOR_MAX_DELIVERIES - SLEEP_SECONDS_FOR_MIN_DELIVERIES
m = (SLEEP_SECONDS_FOR_MAX_DELIVERIES - SLEEP_SECONDS_FOR_MIN_DELIVERIES) / WARMUP_COUNT
```

Which means that our `f(x) = mx + b` turns into:

```f(x) = ((SLEEP_SECONDS_FOR_MAX_DELIVERIES - SLEEP_SECONDS_FOR_MIN_DELIVERIES) / WARMUP_COUNT) * x + SLEEP_SECONDS_FOR_MIN_DELIVERIES```

However, this is an unbounded linear function. We want the result clamped
between the max and min sleep values, so we shove it into a

```max(min(f(x), largest_sleep_value), smallest_sleep_value)```

And we have what we want.
*/

// Calculate using just the linear function.
const calculateUnbounded = (currentCount: number) =>
  ((SLEEP_SECONDS_FOR_MAX_DELIVERIES - SLEEP_SECONDS_FOR_MIN_DELIVERIES) /
    WARMUP_COUNT) *
    currentCount +
  SLEEP_SECONDS_FOR_MIN_DELIVERIES;

// Calculates applying bounds to the linear function. Most confusing piece of
// code I've written in a while :^)
const calculate = (currentCount: number) =>
  Math.max(
    Math.min(
      calculateUnbounded(currentCount),
      SLEEP_SECONDS_FOR_MIN_DELIVERIES,
    ),
    SLEEP_SECONDS_FOR_MAX_DELIVERIES,
  );

/**
 * Mechanism for throttling deliveries as to avoid getting caught by anti-spam
 * measures.
 *
 * Starts at the lowest possible speed, linearly ramps up until the maximum
 * delivery rate over a specified period of time.
 */
export default class DeliveryThrottler {
  private counter = 0;

  calculateNextThrottleSleepTimeInSeconds(): number {
    this.counter += 1;
    return calculate(this.counter);
  }
}

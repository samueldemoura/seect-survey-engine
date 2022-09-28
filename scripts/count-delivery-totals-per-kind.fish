#!/usr/bin/env fish

# Goes to the database and generates a count of how many deliveries have been
# made so far, for each type/kind of person.

echo "
SELECT
  kind,
  COUNT(*)
FROM
  delivery_attempt
JOIN
  person ON person.identifier = delivery_attempt.person_identifier
WHERE
  was_successful = true
GROUP BY kind
;" | sqlite3 survey-engine.db

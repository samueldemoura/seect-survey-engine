#!/usr/bin/env fish

# Goes to the database and generates a count of deliveries per day, segregated
# by person type/kind.

echo "date|kind|count"
echo "
SELECT
	strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as date,
	kind,
	COUNT(0)
FROM
	delivery_attempt
INNER JOIN
	person
ON
	person.identifier = delivery_attempt.person_identifier
WHERE
	was_successful = true
	-- AND timestamp > 1658718000000
GROUP BY
	date,
	person.kind
;" | sqlite3 survey-engine.db

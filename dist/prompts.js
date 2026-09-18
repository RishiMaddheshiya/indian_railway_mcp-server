import { z } from 'zod';
export function registerPrompts(server) {
    server.registerPrompt('plan_trip', {
        title: 'Plan a rail trip',
        description: 'Walk through planning a train journey: resolve stations, compare trains, check availability and fares, and recommend an option.',
        argsSchema: {
            from: z.string().describe('Origin city or station.'),
            to: z.string().describe('Destination city or station.'),
            date: z.string().optional().describe('Travel date (YYYY-MM-DD).'),
            preferences: z
                .string()
                .optional()
                .describe('Free text preferences, e.g. "overnight, AC, arrive before 9am".'),
        },
    }, ({ from, to, date, preferences }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: [
                        `Plan a train journey from ${from} to ${to}${date ? ` on ${date}` : ''}.`,
                        preferences ? `Preferences: ${preferences}` : '',
                        '',
                        'Please:',
                        '1. Resolve both places to station codes (search_stations) and say which you picked if a city has several stations.',
                        '2. Use plan_journey to compare the realistic options.',
                        '3. Recommend one train and class, explaining the trade-off between duration, fare and confirmation odds.',
                        '4. Note anything that would change the answer — a waitlist that may not clear, a train that does not run that weekday, or a long halt.',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                },
            },
        ],
    }));
    server.registerPrompt('check_my_booking', {
        title: 'Check a booking',
        description: 'Look up a PNR and explain what the status means in plain language.',
        argsSchema: {
            pnr: z.string().describe('10 digit PNR number.'),
        },
    }, ({ pnr }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: [
                        `Check PNR ${pnr} and explain the result.`,
                        '',
                        'Cover: whether each passenger is confirmed, what codes like RAC or WL mean for them in practice,',
                        'whether the chart has been prepared, and what they should do next if anything is unconfirmed.',
                    ].join('\n'),
                },
            },
        ],
    }));
}
//# sourceMappingURL=prompts.js.map
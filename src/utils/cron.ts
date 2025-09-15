export function isValidCron(expression: string | undefined): boolean {
    const cronRegex = /^(\*|\d+|\d+(,\d+)*|\d+-\d+)( (\*|\d+|\d+(,\d+)*|\d+-\d+)){4}$/
    return cronRegex.test(expression ?? '')
}

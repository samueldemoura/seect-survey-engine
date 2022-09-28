import readline from 'readline';

const prompt = (promptString: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptString, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

export const promptForContinue = async (): Promise<string> => {
  const answer = (await prompt('\n* Continue? Y/N: ')).toLocaleLowerCase();
  if (answer !== 'y') {
    process.exit(0);
  }

  return answer;
};

export default prompt;

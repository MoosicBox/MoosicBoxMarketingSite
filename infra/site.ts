import { exec } from 'node:child_process';

async function getHostedZoneId(domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(
            `aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${domain}.'].Id"  --output text | sed s#/hostedzone/##`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(stderr);
                    return reject(error);
                }
                resolve(stdout.trim());
            },
        );
    });
}

function getCustomDomain(hostedZoneId: string) {
    return {
        name: domainName,
        dns: sst.aws.dns({
            zone: hostedZoneId,
        }),
    };
}

const domain = process.env.DOMAIN || 'moosicbox.com';

if (!domain) throw new Error('Missing DOMAIN environment variable');

const isProd = $app.stage === 'prod';
const subdomain = isProd ? '' : `marketing-${$app.stage}.`;
const domainName = `${subdomain}${domain}`;

const hostedZoneId = await getHostedZoneId(domain);
const customDomain = getCustomDomain(hostedZoneId);

const site = new sst.aws.Astro('MoosicBoxMarketing', {
    buildCommand: 'pnpm build --config astro.config.sst.mjs',
    domain: customDomain,
    environment: {},
});

export const outputs = {
    url: site.url,
    host: `https://${domainName}`,
};

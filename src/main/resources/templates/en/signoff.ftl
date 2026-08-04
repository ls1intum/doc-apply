<#-- Platform system sign-off, uses the SITE_NAME template variable -->
<#macro system>
    <p>Best regards,<br />Your ${SITE_NAME!} Team</p>
</#macro>

<#-- Research group sign-off, uses the RESEARCH_GROUP_NAME template variable -->
<#macro researchGroup>
    <p>Best regards,<br />Your ${RESEARCH_GROUP_NAME!} Team</p>
</#macro>

<#-- Platform system sign-off, used for emails to external recipients -->
<#macro systemFormal>
    <p>Best regards,<br />Your ${SITE_NAME!} Team</p>
</#macro>

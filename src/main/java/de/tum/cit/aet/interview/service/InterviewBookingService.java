package de.tum.cit.aet.interview.service;

import de.tum.cit.aet.core.constants.Language;
import de.tum.cit.aet.core.dto.PageDTO;
import de.tum.cit.aet.core.exception.AccessDeniedException;
import de.tum.cit.aet.core.exception.BadRequestException;
import de.tum.cit.aet.core.exception.EntityNotFoundException;
import de.tum.cit.aet.core.exception.InterviewProcessClosedException;
import de.tum.cit.aet.core.exception.ResourceAlreadyExistsException;
import de.tum.cit.aet.core.service.CurrentUserService;
import de.tum.cit.aet.interview.domain.InterviewProcess;
import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.interview.domain.Interviewee;
import de.tum.cit.aet.interview.dto.BookingDTO;
import de.tum.cit.aet.interview.dto.InterviewSlotDTO;
import de.tum.cit.aet.interview.dto.IntervieweeState;
import de.tum.cit.aet.interview.dto.UserBookingInfoDTO;
import de.tum.cit.aet.interview.repository.InterviewProcessRepository;
import de.tum.cit.aet.interview.repository.InterviewSlotRepository;
import de.tum.cit.aet.interview.repository.IntervieweeRepository;
import de.tum.cit.aet.job.constants.JobState;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.notification.constants.EmailType;
import de.tum.cit.aet.notification.service.AsyncEmailSender;
import de.tum.cit.aet.notification.service.mail.Email;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ProfessorDTO;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for applicant-facing interview booking operations.
 * Handles booking page data retrieval and slot booking.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewBookingService {

    private final InterviewService interviewService;
    private final InterviewProcessRepository interviewProcessRepository;
    private final IntervieweeRepository intervieweeRepository;
    private final InterviewSlotRepository interviewSlotRepository;
    private final CurrentUserService currentUserService;
    private final IcsCalendarService icsCalendarService;
    private final AsyncEmailSender asyncEmailSender;

    /**
     * Retrieves booking page data for the current user.
     * Contains job info, user's booking status, and available slots.
     *
     * @param processId the ID of the interview process
     * @param yearMonth optional year/month for filtering slots
     * @param pageDTO   pagination parameters
     * @return the booking data DTO
     * @throws EntityNotFoundException if the process doesn't exist
     * @throws AccessDeniedException   if user is not invited to this process
     */
    public BookingDTO getBookingData(UUID processId, YearMonth yearMonth, PageDTO pageDTO) {
        UUID userId = currentUserService.getUserId();

        // 1. Load interview process with job
        InterviewProcess process = interviewProcessRepository
            .findById(processId)
            .orElseThrow(() -> EntityNotFoundException.forId("InterviewProcess", processId));

        // 2. Find interviewee for current user
        Interviewee interviewee = intervieweeRepository
            .findByProcessIdAndUserId(processId, userId)
            .orElseThrow(() -> new AccessDeniedException("You are not invited to this interview process"));

        // 3. Check state - must be at least INVITED (not UNCONTACTED)
        IntervieweeState state = interviewService.calculateIntervieweeState(interviewee);
        if (state == IntervieweeState.UNCONTACTED) {
            throw new AccessDeniedException("You have not yet been invited to book an interview");
        }

        // 4. Build response
        Job job = process.getJob();

        if (job.getState() == JobState.CLOSED || job.getState() == JobState.APPLICANT_FOUND) {
            throw new InterviewProcessClosedException("This interview process is closed because the linked job has been closed.");
        }

        ProfessorDTO supervisor = ProfessorDTO.fromJob(job);

        // 5. Check if already booked
        InterviewSlot bookedSlot = interviewee.getScheduledSlot();
        UserBookingInfoDTO bookingInfo = new UserBookingInfoDTO(
            bookedSlot != null,
            bookedSlot != null ? InterviewSlotDTO.fromEntity(bookedSlot) : null
        );

        // 6. Get available slots (only if not already booked)
        List<InterviewSlotDTO> availableSlots = Collections.emptyList();
        if (bookedSlot == null) {
            availableSlots = loadAvailableSlots(processId, yearMonth, pageDTO);
        }

        return new BookingDTO(
            job.getTitle(),
            job.getResearchGroup() != null ? job.getResearchGroup().getName() : null,
            supervisor,
            bookingInfo,
            availableSlots
        );
    }

    /**
     * Books an interview slot for the current user.
     *
     * @param processId the ID of the interview process
     * @param slotId    the ID of the slot to book
     * @return the booked slot as DTO
     * @throws EntityNotFoundException        if process or slot not found
     * @throws AccessDeniedException          if user not invited or UNCONTACTED
     * @throws BadRequestException            if user already has a slot or slot is
     *                                        in
     *                                        the past
     * @throws ResourceAlreadyExistsException if slot was just booked by another
     *                                        user
     */
    @Transactional
    public InterviewSlotDTO bookSlot(UUID processId, UUID slotId) {
        UUID userId = currentUserService.getUserId();

        // 1. Load interview process
        InterviewProcess process = interviewProcessRepository
            .findById(processId)
            .orElseThrow(() -> EntityNotFoundException.forId("InterviewProcess", processId));

        // 2. Find interviewee for current user
        Interviewee interviewee = intervieweeRepository
            .findByProcessIdAndUserId(processId, userId)
            .orElseThrow(() -> new AccessDeniedException("You are not invited to this interview process"));

        // 3. Check state - must be at least INVITED (not UNCONTACTED)
        IntervieweeState state = interviewService.calculateIntervieweeState(interviewee);
        if (state == IntervieweeState.UNCONTACTED) {
            throw new AccessDeniedException("You have not yet been invited to book an interview");
        }

        if (process.getJob().getState() == JobState.CLOSED || process.getJob().getState() == JobState.APPLICANT_FOUND) {
            throw new InterviewProcessClosedException("This interview process is closed because the linked job has been closed.");
        }

        // 4. Check if user already has a booked slot
        if (interviewee.hasSlot()) {
            throw new BadRequestException("You already have a booked interview slot");
        }

        // 5. Load the requested slot
        InterviewSlot slot = interviewSlotRepository
            .findById(slotId)
            .orElseThrow(() -> EntityNotFoundException.forId("InterviewSlot", slotId));

        // 6. Validate slot belongs to this process
        if (!slot.getInterviewProcess().getId().equals(processId)) {
            throw new EntityNotFoundException("Slot not found in this interview process");
        }

        // 7. Validate slot is in the future
        if (slot.getStartDateTime().isBefore(Instant.now())) {
            throw new BadRequestException("Cannot book a slot in the past");
        }

        // 8. Validate slot is not already booked (race condition check)
        if (slot.getIsBooked()) {
            throw new ResourceAlreadyExistsException("This slot has already been booked by another applicant");
        }

        // 9. Book the slot: establish bidirectional relationship
        slot.setInterviewee(interviewee);
        slot.setIsBooked(true);
        interviewee.getSlots().add(slot);

        // 10. Auto-delete overlapping unbooked slots from other processes (cleanup)
        Job job = process.getJob();
        UUID professorId = job.getSupervisingProfessor().getUserId();
        List<InterviewSlot> overlappingSlots = interviewSlotRepository.findOverlappingUnbookedSlots(
            professorId,
            processId,
            slot.getStartDateTime(),
            slot.getEndDateTime()
        );

        if (!overlappingSlots.isEmpty()) {
            interviewSlotRepository.deleteAll(overlappingSlots);
        }

        // 11. Save entities
        interviewSlotRepository.save(slot);
        intervieweeRepository.save(interviewee);

        // 12. Send confirmation emails
        sendBookingConfirmationEmails(slot, interviewee, job);

        log.info("Slot {} booked by interviewee {} for process {}", slotId, interviewee.getId(), processId);
        return InterviewSlotDTO.fromEntity(slot);
    }

    private void sendBookingConfirmationEmails(InterviewSlot slot, Interviewee interviewee, Job job) {
        User applicant = interviewee.getApplication().getApplicant().getUser();
        User professor = job.getSupervisingProfessor();

        String icsContent = icsCalendarService.generateIcsContent(slot, job);
        String icsFileName = icsCalendarService.generateFileName(slot);

        // Email to Applicant
        Email applicantEmail = Email.builder()
            .to(applicant)
            .emailType(EmailType.INTERVIEW_BOOKED_APPLICANT)
            .language(Language.fromCode(applicant.getSelectedLanguage()))
            .researchGroup(job.getResearchGroup())
            .content(slot)
            .icsContent(icsContent)
            .icsFileName(icsFileName)
            .build();
        asyncEmailSender.sendAsync(applicantEmail);

        // Email to Professor
        Email professorEmail = Email.builder()
            .to(professor)
            .emailType(EmailType.INTERVIEW_BOOKED_PROFESSOR)
            .language(Language.fromCode(professor.getSelectedLanguage()))
            .researchGroup(job.getResearchGroup())
            .content(slot)
            .icsContent(icsContent)
            .icsFileName(icsFileName)
            .build();
        asyncEmailSender.sendAsync(professorEmail);
    }

    /**
     * Loads available slots with optional month filtering.
     *
     * @param processId the interview process ID
     * @param yearMonth optional year/month filter
     * @param pageDTO   pagination parameters
     * @return list of available slot DTOs
     */
    private List<InterviewSlotDTO> loadAvailableSlots(UUID processId, YearMonth yearMonth, PageDTO pageDTO) {
        Pageable pageable = PageRequest.of(pageDTO.pageNumber(), pageDTO.pageSize());
        List<InterviewSlot> slots;

        if (yearMonth != null) {
            // Filter by month (only future slots)
            ZonedDateTime monthStart = yearMonth.atDay(1).atStartOfDay(ZoneId.systemDefault());
            ZonedDateTime monthEnd = yearMonth.plusMonths(1).atDay(1).atStartOfDay(ZoneId.systemDefault());
            slots = interviewSlotRepository
                .findAvailableSlotsByProcessIdAndMonth(processId, Instant.now(), monthStart.toInstant(), monthEnd.toInstant(), pageable)
                .getContent();
        } else {
            // Load all future slots
            slots = interviewSlotRepository.findAvailableSlotsByProcessId(processId, Instant.now());
        }

        return slots.stream().map(InterviewSlotDTO::fromEntity).toList();
    }
}
